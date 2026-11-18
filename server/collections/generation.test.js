const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateQuestions } = require('./generation');
const text = 'Митохондрии обеспечивают клетку энергией. '.repeat(20);
function question(i) { return { text: `Вопрос ${i}`, answers: ['Верно', 'Неверно'],
  correctIndex: 0, sourceId: 1 }; }

test('20 вопросов генерируются порциями и проверяются по конспекту', async () => {
  let calls = 0;
  const questions = await generateQuestions(text, 20, async messages => {
    const input = JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
    assert.ok(input.sources.length > 0);
    for (const source of input.sources) assert.ok(text.includes(source.text));
    assert.equal(input.excludeQuestions.length, calls * 5);
    const offset = calls++ * 5;
    return JSON.stringify({ questions: Array.from({ length: input.requestedCount }, (_, i) => question(offset + i)) });
  });
  assert.equal(calls, 4);
  assert.equal(questions.length, 20);
});

test('недостающие вопросы дополняются, повторные пропускаются', async () => {
  let calls = 0;
  const questions = await generateQuestions(text, 5, async messages => {
    calls += 1;
    if (calls === 1) return JSON.stringify({ questions: [question(0), question(1), question(2)] });
    assert.match(messages[1].content, /ровно 2 новых/);
    return JSON.stringify({ questions: [question(0), question(3), question(4)] });
  });
  assert.equal(calls, 2);
  assert.equal(questions.length, 5);
  assert.equal(new Set(questions.map(q => q.text)).size, 5);
});

test('цитата берётся из исходного фрагмента, а не переписывается моделью', async () => {
  let originalFragment;
  const questions = await generateQuestions(text, 5, async (messages, options) => {
    const input = JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
    originalFragment = input.sources[0].text;
    assert.ok(options.schema.properties.questions.items.properties.sourceId.enum.includes(1));
    return JSON.stringify({ questions: Array.from({ length: 5 }, (_, i) => ({
      ...question(i), sourceQuote: 'Модель перефразировала текст',
    })) });
  });
  for (const question of questions) {
    assert.equal(question.sourceQuote, originalFragment);
    assert.ok(text.includes(question.sourceQuote));
  }
});

test('лишние вопросы не увеличивают выбранное количество', async () => {
  const questions = await generateQuestions(text, 5, async () => JSON.stringify({
    questions: Array.from({ length: 7 }, (_, i) => question(i)),
  }));
  assert.equal(questions.length, 5);
});

test('пустые ответы не вызывают бесконечную генерацию', async () => {
  let calls = 0;
  await assert.rejects(generateQuestions(text, 5, async () => {
    calls += 1;
    return JSON.stringify({ questions: [] });
  }), /0 из 5/);
  assert.equal(calls, 8);
});

test('неправильные входные данные не отправляются модели', async () => {
  for (const count of [4, 21, 5.5, NaN]) {
    await assert.rejects(generateQuestions(text, count, () => assert.fail('unexpected network')));
  }
  await assert.rejects(generateQuestions('мало', 5, () => assert.fail('unexpected network')));
});

test('JSON-схема передаётся модели; некорректный ответ повторяется один раз', async () => {
  let calls = 0;
  const questions = await generateQuestions(text, 5, async (messages, options) => {
    assert.equal(options.schema.type, 'object');
    assert.ok(options.schema.required.includes('questions'));
    if (calls++ === 0) return 'Вот ваши вопросы:';
    assert.match(messages.at(-1).content, /корректный JSON/);
    return JSON.stringify({ insufficient: false,
      questions: Array.from({ length: 5 }, (_, i) => question(i)) });
  });
  assert.equal(calls, 2);
  assert.equal(questions.length, 5);
});

test('ошибки модели не становятся коллекцией', async () => {
  const valid = Array.from({ length: 5 }, (_, i) => question(i));
  const cases = ['не JSON', JSON.stringify({ insufficient: true }),
    JSON.stringify({ questions: valid.slice(1) }),
    JSON.stringify({ questions: valid.map(q => ({ ...q, sourceId: 99999 })) }),
    JSON.stringify({ questions: valid.map(q => ({ ...q, correctIndex: 10 })) }),
    JSON.stringify({ questions: valid.map(() => question(1)) })];
  for (const reply of cases) await assert.rejects(generateQuestions(text, 5, async () => reply));
});
