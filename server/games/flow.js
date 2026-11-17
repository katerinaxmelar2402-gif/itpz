const { httpError } = require('../collections/read');

function check(condition, message, status = 400) {
  if (!condition) throw httpError(status, message);
}

function time(value) {
  check(typeof value === 'string' && value.length <= 40, 'Некорректное время.');
  const milliseconds = Date.parse(value);
  check(Number.isFinite(milliseconds), 'Некорректное время.');
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

// Проверяем всю историю по порядку ходов, а не по номеру вопроса:
// один и тот же вопрос может встречаться несколько раз.
function evaluateAnswers(questions, initialHp, answerSeconds, answers, savedRows) {
  check(answers.length <= initialHp * 2 - 1, 'Слишком много ответов для этого боя.');
  const ids = questions.map(question => question.sessionQuestionId);
  const byId = new Map(questions.map(question => [question.sessionQuestionId, question]));
  let remaining = new Set(ids);
  let priority = [...ids];
  const unresolved = new Set();
  const occurrences = new Map();
  let playerHp = initialHp;
  let foxHp = initialHp;
  let duration = 0;
  let previousAnswerTime = null;
  const normalized = [];

  for (const [index, raw] of answers.entries()) {
    check(playerHp > 0 && foxHp > 0, 'Бой уже закончился.');
    if (remaining.size === 0) {
      remaining = new Set(ids);
      priority = ids.filter(id => unresolved.has(id));
    }
    const id = raw && String(raw.sessionQuestionId);
    const question = byId.get(id);
    check(question && remaining.has(id), 'Нарушен порядок вопросов.');
    if (priority.length) {
      check(id === priority[0], 'Сначала ответь на вопросы с ошибками.');
      priority.shift();
    }
    remaining.delete(id);

    const occurrenceNo = (occurrences.get(id) ?? 0) + 1;
    occurrences.set(id, occurrenceNo);
    check((raw.occurrenceNo ?? 1) === occurrenceNo, 'Некорректный номер повторения вопроса.');

    const selected = raw.selectedIndex;
    check(selected === null || (
      Number.isInteger(selected) && selected >= 0 && selected < question.answers.length
    ), 'Некорректный выбранный ответ.');
    const limit = answerSeconds * 1000;
    check(Number.isInteger(raw.responseMs) && raw.responseMs >= 0
      && raw.responseMs <= limit, 'Некорректная длительность ответа.');
    check(selected !== null || raw.responseMs === limit,
      'Для тайм-аута должно закончиться время.');

    const shown = time(raw.shownAt);
    const deadline = time(raw.deadlineAt);
    const answered = time(raw.answeredAt);
    check(shown.milliseconds <= answered.milliseconds
      && shown.milliseconds <= deadline.milliseconds
      && (selected === null
        ? answered.milliseconds >= deadline.milliseconds
        : answered.milliseconds < deadline.milliseconds)
      && (previousAnswerTime === null || shown.milliseconds >= previousAnswerTime),
    'Некорректная последовательность времени.');
    previousAnswerTime = answered.milliseconds;

    const outcome = selected === null ? 'timeout'
      : selected === question.correctIndex ? 'correct' : 'wrong';
    const selectedOptionId = selected === null ? null : question.optionIds[selected];
    const old = savedRows[index];
    if (old) {
      check(String(old.session_question_id) === id
        && Number(old.occurrence_no) === occurrenceNo
        && String(old.selected_option_id) === String(selectedOptionId)
        && old.outcome === outcome
        && Number(old.elapsed_ms) === raw.responseMs,
      'Сохранённый ответ нельзя изменить.', 409);
    }

    if (outcome === 'correct') {
      foxHp -= 1;
      unresolved.delete(id);
    } else {
      playerHp -= 1;
      unresolved.add(id);
    }
    duration += raw.responseMs;
    normalized.push({
      question, occurrenceNo, old, selectedOptionId, outcome,
      shownAt: shown.iso, deadlineAt: deadline.iso, answeredAt: answered.iso,
      responseMs: raw.responseMs,
    });
  }
  return { playerHp, foxHp, duration, normalized };
}

module.exports = { evaluateAnswers };
