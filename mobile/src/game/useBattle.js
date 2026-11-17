import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { saveBattle } from './history';
import {
  createBattle,
  answerBattle,
  pauseBattle,
  resumeBattle,
  advanceBattle,
  abandonBattle,
} from './battleState';

function isForeground() {
  return AppState.currentState !== 'background'
    && AppState.currentState !== 'inactive';
}

function saveMessage(reason) {
  return reason instanceof Error ? reason.message : 'Не удалось сохранить результаты.';
}

export function useBattle({ userId, collection, settings }) {
  const { request } = useAuth();
  const [state, setState] = useState(() =>
    createBattle(userId, collection, settings, Date.now(), isForeground()),
  );
  const current = useRef(state);
  const [clock, setClock] = useState(() => Date.now());
  const [saveError, setSaveError] = useState('');

  const publish = useCallback(next => {
    if (next === current.current) return;
    current.current = next;
    setState(next);
  }, []);

  const answer = useCallback((selectedIndex, expectedIndex) => {
    publish(answerBattle(current.current, collection, selectedIndex, expectedIndex, Date.now()));
  }, [collection, publish]);

  const pause = useCallback(() => {
    publish(pauseBattle(current.current, collection, Date.now()));
  }, [collection, publish]);

  const resume = useCallback(() => {
    if (!isForeground()) return;
    const now = Date.now();
    setClock(now);
    publish(resumeBattle(current.current, now));
  }, [publish]);

  useEffect(() => {
    let active = true;
    saveBattle(state.record, request)
      .then(() => { if (active) setSaveError(''); })
      .catch(reason => { if (active) setSaveError(saveMessage(reason)); });
    return () => { active = false; };
  }, [state.record, request]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      publish(advanceBattle(current.current, collection, now, isForeground()));
    }, 50);
    return () => clearInterval(timer);
  }, [collection, publish]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  const persist = useCallback(async record => {
    try {
      await saveBattle(record, request);
      setSaveError('');
    } catch (reason) {
      setSaveError(saveMessage(reason));
      throw reason;
    }
  }, [request]);

  const retrySave = useCallback(() => persist(current.current.record), [persist]);

  const saveAndExit = useCallback(async () => {
    const next = abandonBattle(current.current, Date.now());
    publish(next);
    await persist(next.record);
  }, [persist, publish]);

  const limit = state.record.settings.answerSeconds * 1000;
  const remainingMs = Math.max(0, Math.min(limit,
    state.phase === 'asking' ? state.deadline - clock : state.remainingMs,
  ));

  return {
    ...state,
    question: collection.questions[state.questionIndex],
    seconds: Math.ceil(remainingMs / 1000),
    progress: remainingMs / limit,
    saveError,
    answer,
    pause,
    resume,
    retrySave,
    saveAndExit,
  };
}
