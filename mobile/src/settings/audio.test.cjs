const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(file) {
  const slots = [];
  let cursor = 0;
  let jobs = [];
  let appListener;
  let nextTimer = 0;
  const timers = new Map();
  const calls = [];
  const settings = { app: { music: true, sound: true }, loading: false };
  const audio = { ready: true, foreground: true, setBattlePhase: phase => calls.push(['phase', phase]) };
  const player = {
    isLoaded: true,
    play() { calls.push(['play']); },
    pause() { calls.push(['pause']); },
    async seekTo(position) { calls.push(['seek', position]); },
  };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useContext: () => audio,
    useMemo: factory => factory(),
    useCallback: callback => callback,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: typeof initial === 'function' ? initial() : initial };
        slot.set = value => { slot.value = typeof value === 'function' ? value(slot.value) : value; };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        jobs.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { AppState: {
      currentState: 'active',
      addEventListener(event, callback) { appListener = callback; return { remove() {} }; },
    } },
    'expo-audio': {
      useAudioPlayer: () => player,
      useAudioPlayerStatus: () => ({ isLoaded: player.isLoaded }),
      setAudioModeAsync: async mode => { calls.push(['mode', mode]); },
    },
    './SettingsProvider': { useSettings: () => settings },
    './AudioProvider': { useAppAudio: () => audio },
    '../game/battleState': { HIT_MS: 200 },
  };
  const filename = path.join(__dirname, file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console,
    Date: { now: () => 1000 },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    require: id => {
      if (id.endsWith('.mp3') || id.endsWith('.wav')) return 1;
      if (!(id in dependencies)) throw new Error(`Unexpected import ${id}`);
      return dependencies[id];
    },
  }, { filename });

  return {
    exports: module.exports, settings, audio, player, calls, timers,
    render(callback) {
      cursor = 0;
      jobs = [];
      const result = callback(module.exports);
      for (const job of jobs) job();
      return result;
    },
    changeApp: state => appListener(state),
  };
}

const battle = (phase, index = 0) => ({
  phase, index, feedbackAt: 1000, record: { serverSessionId: '42' },
});

test('music waits for audio session and loading, then respects pause, preference and foreground', async () => {
  const h = harness('AudioProvider.jsx');
  const render = () => h.render(({ AudioProvider }) => AudioProvider({ children: null }));
  render();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
  await Promise.resolve();
  let provider = render();
  assert.equal(h.calls.at(-1)[0], 'play');
  assert.equal(h.player.loop, true);
  assert.equal(h.calls[0][1].playsInSilentMode, true);
  provider.props.value.setBattlePhase('paused');
  render();
  assert.equal(h.calls.at(-1)[0], 'pause');
  provider.props.value.setBattlePhase('asking');
  provider = render();
  assert.equal(h.calls.at(-1)[0], 'play');
  h.settings.app.music = false;
  render();
  assert.equal(h.calls.at(-1)[0], 'pause');
  h.settings.app.music = true;
  h.changeApp('background');
  render();
  assert.equal(h.calls.at(-1)[0], 'pause');
  h.changeApp('active');
  render();
  assert.equal(h.calls.at(-1)[0], 'play');
  provider.props.value.setBattlePhase('finished');
  render();
  assert.equal(h.calls.at(-1)[0], 'pause');
});

test('impact plays at damage time once per turn, including repeated questions', async () => {
  const h = harness('audio.js');
  const render = state => h.render(({ useBattleAudio }) => useBattleAudio(state));
  render(battle('asking'));
  assert.equal(h.timers.size, 0);
  render(battle('feedback'));
  const timer = [...h.timers.values()][0];
  assert.equal(timer.delay, 200);
  await timer.callback();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  render(battle('feedback'));
  await timer.callback();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  render(battle('asking', 1));
  render(battle('feedback', 1));
  await [...h.timers.values()].at(-1).callback();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 2);
});

test('disabled sound and leaving foreground cancel a pending hit', async () => {
  const h = harness('audio.js');
  const render = () => h.render(({ useBattleAudio }) => useBattleAudio(battle('feedback')));
  h.settings.app.sound = false;
  render();
  assert.equal(h.timers.size, 0);
  h.settings.app.sound = true;
  render();
  const timer = [...h.timers.values()][0];
  h.audio.foreground = false;
  render();
  assert.equal(h.timers.size, 0);
  await timer.callback();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
});

test('finishing battle during seek does not play a late hit', async () => {
  const h = harness('audio.js');
  let release;
  h.player.seekTo = () => new Promise(resolve => { release = resolve; });
  h.render(({ useBattleAudio }) => useBattleAudio(battle('feedback')));
  const pending = [...h.timers.values()][0].callback();
  h.render(({ useBattleAudio }) => useBattleAudio(battle('finished')));
  release();
  await pending;
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
});
