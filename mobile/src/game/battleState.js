export const HIT_MS = 200;
export const FEEDBACK_MS = 900;

export function createBattle(userId, collection, settings, now, foreground = true) {
  return {
    phase: foreground ? 'asking' : 'paused',
    index: 0,
    questionIndex: 0,
    questionQueue: collection.questions.map((_, index) => index),
    queuePosition: 0,
    round: 1,
    shownAt: foreground ? new Date(now).toISOString() : null,
    deadline: now + settings.answerSeconds * 1000,
    remainingMs: settings.answerSeconds * 1000,
    feedbackAt: null,
    selectedIndex: null,
    outcome: null,
    playerHp: settings.lives,
    foxHp: settings.lives,
    record: {
      version: 3,
      id: String(collection.gameSessionId),
      serverSessionId: String(collection.gameSessionId),
      userId: String(userId),
      collectionId: String(collection.id),
      collectionTitle: collection.title,
      startedAt: collection.startedAt,
      finishedAt: null,
      status: 'active',
      result: null,
      settings: { ...settings },
      playerHp: settings.lives,
      foxHp: settings.lives,
      answers: [],
    },
  };
}

export function answerBattle(state, collection, selectedIndex, expectedIndex, now) {
  if (state.phase !== 'asking' || state.index !== expectedIndex) return state;

  const question = collection.questions[state.questionIndex];
  const timeout = now >= state.deadline;

  if (!timeout && (
    !Number.isInteger(selectedIndex)
    || selectedIndex < 0
    || selectedIndex >= question.answers.length
  )) return state;

  const selected = timeout ? null : selectedIndex;
  const outcome = timeout ? 'timeout'
    : selected === question.correctIndex ? 'correct' : 'wrong';
  const playerHp = state.playerHp - (outcome === 'correct' ? 0 : 1);
  const foxHp = state.foxHp - (outcome === 'correct' ? 1 : 0);
  const limit = state.record.settings.answerSeconds * 1000;
  const remainingMs = Math.max(0, Math.min(limit, state.deadline - now));

  return {
    ...state,
    phase: 'feedback',
    feedbackAt: now,
    selectedIndex: selected,
    outcome,
    remainingMs,
    record: {
      ...state.record,
      playerHp,
      foxHp,
      answers: [...state.record.answers, {
        questionId: question.id == null ? null : String(question.id),
        sessionQuestionId: question.sessionQuestionId,
        questionIndex: state.questionIndex,
        occurrenceNo: state.record.answers.filter(answer =>
          answer.sessionQuestionId === question.sessionQuestionId
        ).length + 1,
        questionText: question.text,
        answers: [...question.answers],
        correctIndex: question.correctIndex,
        selectedIndex: selected,
        outcome,
        shownAt: state.shownAt,
        deadlineAt: new Date(state.deadline).toISOString(),
        answeredAt: new Date(now).toISOString(),
        responseMs: limit - remainingMs,
        playerHpAfter: playerHp,
        foxHpAfter: foxHp,
      }],
    },
  };
}

export function pauseBattle(state, collection, now) {
  if (state.phase !== 'asking') return state;
  if (now >= state.deadline) {
    return answerBattle(state, collection, null, state.index, now);
  }

  return { ...state, phase: 'paused', remainingMs: state.deadline - now };
}

export function resumeBattle(state, now) {
  if (state.phase !== 'paused') return state;

  return {
    ...state,
    phase: 'asking',
    shownAt: state.shownAt ?? new Date(now).toISOString(),
    deadline: now + state.remainingMs,
  };
}

// Новый круг начинается с ещё не исправленных ошибок.
// Остальные вопросы перемешиваются без повторов внутри круга.
export function nextQuestionQueue(collection, answers, random = Math.random) {
  const latest = new Map(answers.map(answer => [answer.questionIndex, answer.outcome]));
  const priority = [];
  const others = [];
  collection.questions.forEach((_, index) => {
    if (['wrong', 'timeout'].includes(latest.get(index))) priority.push(index);
    else others.push(index);
  });
  for (let index = others.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [others[index], others[other]] = [others[other], others[index]];
  }
  return [...priority, ...others];
}

export function advanceBattle(state, collection, now, foreground = true) {
  if (state.phase === 'asking' && now >= state.deadline) {
    return answerBattle(state, collection, null, state.index, now);
  }
  if (state.phase !== 'feedback') return state;

  const elapsed = now - state.feedbackAt;

  if (elapsed >= FEEDBACK_MS) {
    const { playerHp, foxHp, settings } = state.record;
    const damaged = { ...state, playerHp, foxHp };

    if (playerHp === 0 || foxHp === 0) {
      return {
        ...damaged,
        phase: 'finished',
        record: {
          ...state.record,
          status: 'completed',
          result: playerHp > 0 ? 'win' : 'loss',
          finishedAt: new Date(now).toISOString(),
        },
      };
    }

    const newRound = state.queuePosition + 1 >= state.questionQueue.length;
    const questionQueue = newRound
      ? nextQuestionQueue(collection, state.record.answers)
      : state.questionQueue;
    const queuePosition = newRound ? 0 : state.queuePosition + 1;

    return {
      ...damaged,
      phase: foreground ? 'asking' : 'paused',
      index: state.index + 1,
      questionIndex: questionQueue[queuePosition],
      questionQueue,
      queuePosition,
      round: state.round + (newRound ? 1 : 0),
      shownAt: foreground ? new Date(now).toISOString() : null,
      selectedIndex: null,
      outcome: null,
      feedbackAt: null,
      remainingMs: settings.answerSeconds * 1000,
      deadline: now + settings.answerSeconds * 1000,
    };
  }

  if (elapsed >= HIT_MS && (
    state.playerHp !== state.record.playerHp || state.foxHp !== state.record.foxHp
  )) {
    return { ...state, playerHp: state.record.playerHp, foxHp: state.record.foxHp };
  }
  return state;
}

export function abandonBattle(state, now) {
  if (state.record.status !== 'active') return state;
  return {
    ...state,
    phase: 'finished',
    record: {
      ...state.record,
      status: 'abandoned',
      result: null,
      finishedAt: new Date(now).toISOString(),
    },
  };
}
