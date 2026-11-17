const { Router } = require('express');
const { randomInt } = require('node:crypto');

const pool = require('../db');

const {
  readToken,
  findSessionUser,
} = require('../auth/sessions');

const {
  httpError,
  findCollection,
  readQuestions,
} = require('../collections/read');

const { evaluateAnswers } = require('./flow');
const { readStatistics } = require('./statistics');

const router = Router();

function requireValue(condition, message, status = 400) {
  if (!condition) throw httpError(status, message);
}

function validId(value) {
  return /^[1-9]\d*$/.test(String(value));
}

function integer(value, minimum, maximum) {
  return Number.isInteger(value)
    && value >= minimum
    && value <= maximum;
}

function isoTime(value) {
  requireValue(
    typeof value === 'string' && value.length <= 40,
    'Некорректное время.',
  );

  const date = new Date(value);

  requireValue(
    Number.isFinite(date.getTime()),
    'Некорректное время.',
  );

  return date.toISOString();
}

function sqlTime(value) {
  return isoTime(value).slice(0, 23).replace('T', ' ');
}

async function transaction(work) {
  const db = await pool.getConnection();

  try {
    await db.beginTransaction();
    const result = await work(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

// Все изменения игровых данных одного пользователя
// выполняются последовательно, включая question_progress.
async function lockUser(db, userId) {
  await db.execute(
    'SELECT id FROM users WHERE id = ? FOR UPDATE',
    [userId],
  );
}

async function readGame(db, sessionId, userId) {
  requireValue(validId(sessionId), 'Бой не найден.', 404);

  const [rows] = await db.execute(`
    SELECT
      game.*,
      sets.set_id,
      sets.set_title_snapshot,
      DATE_FORMAT(
        game.started_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS startedAt,
      DATE_FORMAT(
        game.finished_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS finishedAt
    FROM game_sessions AS game
    JOIN session_sets AS sets
      ON sets.session_id = game.id
    WHERE game.id = ? AND game.user_id = ?
  `, [sessionId, userId]);

  const game = rows[0];

  requireValue(game, 'Бой не найден.', 404);
  if (rows.length > 1 || game.set_id === null) {
    game.set_id = 'all';
    game.set_title_snapshot = 'Работа над ошибками · все коллекции';
  }

  const [questionRows] = await db.execute(`
    SELECT
      question.id AS session_question_id,
      question.question_id,
      question.question_revision,
      question.text_snapshot,
      sets.set_id AS collection_id,
      sets.set_title_snapshot AS collection_title,
      option_row.id AS option_id,
      option_row.text_snapshot AS option_text,
      option_row.is_correct
    FROM session_questions AS question
    JOIN session_sets AS sets
      ON sets.id = question.session_set_id
    LEFT JOIN session_options AS option_row
      ON option_row.session_question_id = question.id
    WHERE sets.session_id = ?
    ORDER BY question.initial_position, question.id, option_row.id
  `, [sessionId]);

  const questions = new Map();

  for (const row of questionRows) {
    const key = String(row.session_question_id);

    if (!questions.has(key)) {
      questions.set(key, {
        id: row.question_id === null
          ? null
          : String(row.question_id),
        sessionQuestionId: key,
        revision: Number(row.question_revision),
        text: row.text_snapshot,
        collectionId: row.collection_id == null ? null : String(row.collection_id),
        collectionTitle: row.collection_title,
        answers: [],
        optionIds: [],
        correctIndex: null,
      });
    }

    const question = questions.get(key);

    if (row.option_id !== null) {
      if (row.is_correct) {
        question.correctIndex = question.answers.length;
      }

      question.answers.push(row.option_text);
      question.optionIds.push(String(row.option_id));
    }
  }

  return {
    game,
    questions: [...questions.values()],
  };
}

function publicGame({ game, questions }) {
  return {
    sessionId: String(game.id),
    mode: game.mode,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    status: game.status,
    result: game.result,
    playerHp: Number(game.player_hp),
    foxHp: Number(game.enemy_hp),
    settings: {
      lives: Number(game.initial_hp),
      answerSeconds: Number(game.answer_seconds),
      questionOrder: game.question_order,
    },
    collection: {
      id: String(game.set_id),
      title: game.set_title_snapshot,
      questions,
    },
  };
}

async function updateProgress(db, userId, question, answerId, answer) {
  if (!question.id) return;

  const [liveRows] = await db.execute(`
    SELECT revision
    FROM questions
    WHERE id = ? AND deleted_at IS NULL
  `, [question.id]);

  // Ответ на старую версию вопроса сохраняется в истории,
  // но не меняет прогресс уже отредактированного вопроса.
  if (
    !liveRows[0]
    || Number(liveRows[0].revision) !== question.revision
  ) {
    return;
  }

  const [rows] = await db.execute(`
    SELECT *,
      DATE_FORMAT(
        updated_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS updatedAt
    FROM question_progress
    WHERE user_id = ? AND question_id = ?
    FOR UPDATE
  `, [userId, question.id]);

  const old = rows[0];

  if (
    old
    && Number(old.question_revision) === question.revision
    && new Date(old.updatedAt).getTime()
      > new Date(answer.answeredAt).getTime()
  ) {
    return;
  }

  const sameRevision = old
    && Number(old.question_revision) === question.revision;

  const wrong = answer.outcome !== 'correct';

  const lastErrorId = wrong
    ? answerId
    : sameRevision ? old.last_error_answer_id : null;

  const correctedById = !wrong
    && sameRevision
    && old.has_unresolved_error
      ? answerId
      : !wrong && sameRevision
        ? old.corrected_by_answer_id
        : null;

  await db.execute(`
    INSERT INTO question_progress (
      user_id,
      question_id,
      question_revision,
      has_unresolved_error,
      last_error_answer_id,
      corrected_by_answer_id,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      question_revision = ?,
      has_unresolved_error = ?,
      last_error_answer_id = ?,
      corrected_by_answer_id = ?,
      updated_at = ?
  `, [
    userId,
    question.id,
    question.revision,
    wrong,
    lastErrorId,
    correctedById,
    sqlTime(answer.answeredAt),

    question.revision,
    wrong,
    lastErrorId,
    correctedById,
    sqlTime(answer.answeredAt),
  ]);
}

router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  const token = readToken(req);
  const user = token
    ? await findSessionUser(pool, token)
    : null;

  if (!user) {
    throw httpError(401, 'Сессия истекла. Войди снова.');
  }

  res.locals.userId = user.id;
  next();
});

router.get('/statistics', async (req, res) => {
  res.json(await transaction(db => readStatistics(db, res.locals.userId)));
});

// Создание боя. Повтор запроса с тем же clientKey
// возвращает уже созданный бой.
router.post('/', async (req, res) => {
  const userId = res.locals.userId;
  const body = req.body ?? {};

  requireValue(
    typeof body.clientKey === 'string'
      && /^[a-zA-Z0-9-]{12,80}$/.test(body.clientKey),
    'Некорректный ключ запуска.',
  );

  requireValue(validId(body.collectionId) || body.collectionId === 'all', 'Не выбрана коллекция.');

  const data = await transaction(async db => {
    await lockUser(db, userId);

    const [existing] = await db.execute(`
      SELECT id
      FROM game_sessions
      WHERE user_id = ? AND client_key = ?
    `, [userId, body.clientKey]);

    if (existing[0]) {
      const snapshot = await readGame(db, existing[0].id, userId);

      requireValue(
        String(snapshot.game.set_id) === String(body.collectionId)
          || (body.collectionId === 'all' && snapshot.game.mode === 'mistakes'),
        'Ключ запуска уже используется другой игрой.',
        409,
      );

      return publicGame(snapshot);
    }

    let collection;
    let questions;
    let lives = body.lives;
    let seconds = body.answerSeconds;
    let order = body.questionOrder ?? 'ordered';
    let sourceId = null;
    let mode = 'normal';
    const statisticsReview = body.statisticsQuestionIds != null;

    requireValue(!(body.reviewSessionId && body.repeatSessionId),
      'Нельзя одновременно повторить бой и начать работу над ошибками.');
    requireValue(!(statisticsReview && (body.reviewSessionId || body.repeatSessionId)),
      'Выбери один способ работы над ошибками.');

    if (statisticsReview) {
      requireValue(Array.isArray(body.statisticsQuestionIds)
        && body.statisticsQuestionIds.length > 0 && body.statisticsQuestionIds.length <= 10000,
      'Выбери вопросы для работы над ошибками.');
      const selected = new Set(body.statisticsQuestionIds.map(String));
      requireValue(selected.size === body.statisticsQuestionIds.length, 'Вопросы не должны повторяться.');
      const statistics = await readStatistics(db, userId);
      const eligible = statistics.mistakes.filter(question => selected.has(question.sessionQuestionId)
        && (body.collectionId === 'all' || question.collectionId === String(body.collectionId)));
      requireValue(eligible.length === selected.size, 'Список ошибок изменился. Обнови статистику и выбери вопросы снова.');
      const sources = new Map();
      for (const question of eligible) {
        if (!sources.has(question.sourceSessionId)) sources.set(question.sourceSessionId,
          await readGame(db, question.sourceSessionId, userId));
      }
      questions = eligible.map(question => sources.get(question.sourceSessionId).questions
        .find(snapshot => snapshot.sessionQuestionId === question.sessionQuestionId));
      collection = { id: body.collectionId,
        title: body.collectionId === 'all' ? 'Работа над ошибками · все коллекции' : questions[0].collectionTitle };
      lives = questions.length;
      seconds = body.answerSeconds ?? 20;
      order = 'ordered';
      mode = 'mistakes';
    } else if (body.reviewSessionId != null) {
      requireValue(validId(body.reviewSessionId), 'Некорректный бой для работы над ошибками.');
      const source = await readGame(db, body.reviewSessionId, userId);
      requireValue(source.game.status === 'completed'
        && String(source.game.set_id) === String(body.collectionId),
      'Работа над ошибками доступна после завершённого боя.');
      requireValue(Array.isArray(body.reviewQuestionIds)
        && body.reviewQuestionIds.length > 0
        && body.reviewQuestionIds.length <= source.questions.length,
      'Выбери вопросы для работы над ошибками.');
      const selected = new Set(body.reviewQuestionIds.map(String));
      requireValue(selected.size === body.reviewQuestionIds.length,
        'Вопросы не должны повторяться в списке выбора.');
      const [errors] = await db.execute(`
        SELECT DISTINCT answer.session_question_id
        FROM session_answers AS answer
        JOIN session_questions AS question ON question.id = answer.session_question_id
        JOIN session_sets AS sets ON sets.id = question.session_set_id
        WHERE sets.session_id = ? AND answer.outcome IN ('wrong', 'timeout')
      `, [source.game.id]);
      const eligible = new Set(errors.map(row => String(row.session_question_id)));
      requireValue([...selected].every(id => eligible.has(id)),
        'Можно выбрать только вопросы, в которых были ошибки.');
      questions = source.questions.filter(question => selected.has(question.sessionQuestionId));
      requireValue(questions.length === selected.size, 'Не найдены выбранные вопросы.');
      collection = { id: source.game.set_id, title: source.game.set_title_snapshot };
      lives = questions.length;
      seconds = Number(source.game.answer_seconds);
      order = 'ordered';
      sourceId = source.game.id;
      mode = 'mistakes';
    } else {
      if (body.collectionId !== 'all') {
        collection = await findCollection(db, body.collectionId, userId, true);
        questions = await readQuestions(db, collection.id);
      } else {
        requireValue(body.repeatSessionId, 'Выбери вопросы для работы над ошибками.');
      }
      if (body.repeatSessionId != null) {
        requireValue(validId(body.repeatSessionId), 'Некорректный бой для повтора.');
        const source = await readGame(db, body.repeatSessionId, userId);
        requireValue(source.game.status === 'completed'
          && String(source.game.set_id) === String(body.collectionId),
        'Эту игру нельзя использовать для повтора.');
        collection ??= { id: source.game.set_id, title: source.game.set_title_snapshot };
        lives = Number(source.game.initial_hp);
        seconds = Number(source.game.answer_seconds);
        order = source.game.question_order;
        sourceId = source.game.id;
        mode = 'repeat';
        if (source.game.mode === 'mistakes') {
          questions = source.questions;
          mode = 'mistakes';
        }
      }
      requireValue(integer(lives, 1, mode === 'mistakes' ? 10000 : 20),
        'Некорректное количество жизней.');
      lives = Math.min(lives, questions.length);
    }
    requireValue(integer(seconds, 5, 120), 'Время: от 5 до 120 секунд.');

    requireValue(
      ['ordered', 'random'].includes(order),
      'Неизвестный порядок вопросов.',
    );

    requireValue(
      questions.length > 0 && questions.length <= (mode === 'mistakes' ? 10000 : 100),
      'В коллекции нет вопросов или их слишком много.',
    );

    for (const question of questions) {
      requireValue(
        question.answers.length >= 2
          && question.answers.length <= 6
          && integer(
            question.correctIndex,
            0,
            question.answers.length - 1,
          ),
        'В коллекции есть некорректный вопрос.',
      );
    }

    if (order === 'random') {
      for (let index = questions.length - 1; index > 0; index -= 1) {
        const other = randomInt(index + 1);

        [questions[index], questions[other]] = [
          questions[other],
          questions[index],
        ];
      }
    }

    const [created] = await db.execute(`
      INSERT INTO game_sessions (
        user_id,
        client_key,
        mode,
        source_session_id,
        initial_hp,
        answer_seconds,
        question_order,
        player_hp,
        enemy_hp,
        status,
        result,
        started_at,
        finished_at,
        active_duration_ms
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'active', NULL, UTC_TIMESTAMP(6), NULL, 0
      )
    `, [
      userId,
      body.clientKey,
      mode,
      sourceId,
      lives,
      seconds,
      order,
      lives,
      lives,
    ]);

    const sessionId = created.insertId;

    const setRows = new Map();
    for (const [index, question] of questions.entries()) {
      const setId = question.collectionId !== undefined ? question.collectionId : collection.id;
      if (!setRows.has(setId)) {
        const [setRow] = await db.execute(`
          INSERT INTO session_sets (session_id, set_id, set_title_snapshot, visible_in_statistics)
          VALUES (?, ?, ?, 1)
        `, [sessionId, setId, question.collectionTitle ?? collection.title]);
        setRows.set(setId, setRow.insertId);
      }
      const [questionRow] = await db.execute(`
        INSERT INTO session_questions (
          session_set_id,
          question_id,
          question_revision,
          text_snapshot,
          initial_position
        )
        VALUES (?, ?, ?, ?, ?)
      `, [
        setRows.get(setId),
        question.id,
        question.revision,
        question.text,
        index + 1,
      ]);

      for (const [answerIndex, text] of question.answers.entries()) {
        await db.execute(`
          INSERT INTO session_options (
            session_question_id,
            text_snapshot,
            is_correct
          )
          VALUES (?, ?, ?)
        `, [
          questionRow.insertId,
          text,
          answerIndex === question.correctIndex,
        ]);
      }
    }

    return publicGame(await readGame(db, sessionId, userId));
  });

  res.json(data);
});

// Принимаем полный накопленный список ответов.
// Уже записанные ответы не создаются повторно.
router.put('/:id', async (req, res) => {
  const userId = res.locals.userId;
  const body = req.body ?? {};

  requireValue(Array.isArray(body.answers), 'Нет списка ответов.');

  requireValue(
    ['active', 'completed', 'abandoned'].includes(body.status),
    'Некорректное состояние боя.',
  );

  const result = await transaction(async db => {
    await lockUser(db, userId);

    const { game, questions } = await readGame(
      db,
      req.params.id,
      userId,
    );

    const [savedRows] = await db.execute(`
      SELECT answer.*
      FROM session_answers AS answer
      JOIN session_questions AS question ON question.id = answer.session_question_id
      JOIN session_sets AS sets ON sets.id = question.session_set_id
      WHERE sets.session_id = ?
      ORDER BY answer.id
    `, [game.id]);

    const { playerHp, foxHp, duration, normalized } = evaluateAnswers(
      questions, Number(game.initial_hp), Number(game.answer_seconds), body.answers, savedRows,
    );

    // Запоздавший запрос не уменьшает число сохранённых ответов.
    if (body.answers.length < savedRows.length) {
      return { sessionId: String(game.id), status: game.status };
    }

    // Завершённый бой неизменяем.
    if (game.status !== 'active') {
      requireValue(
        body.answers.length === savedRows.length,
        'Бой уже завершён.',
        409,
      );

      return {
        sessionId: String(game.id),
        status: game.status,
        result: game.result,
      };
    }

    const naturallyFinished = playerHp === 0
      || foxHp === 0
      || (body.version === 2 && body.status === 'completed'
        && body.answers.length === questions.length);

    requireValue(
      body.status !== 'completed' || naturallyFinished,
      'В бою ещё остались вопросы.',
    );

    const status = naturallyFinished
      ? 'completed'
      : body.status === 'abandoned'
        ? 'abandoned'
        : 'active';

    const battleResult = status !== 'completed'
      ? null
      : playerHp === foxHp
        ? 'draw'
        : playerHp > foxHp
          ? 'win'
          : 'loss';

    for (const answer of normalized) {
      if (answer.old) continue;

      const [inserted] = await db.execute(`
        INSERT INTO session_answers (
          session_question_id,
          occurrence_no,
          selected_option_id,
          shown_at,
          deadline_at,
          paused_remaining_ms,
          answered_at,
          elapsed_ms,
          outcome,
          display_option_order
        )
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `, [
        answer.question.sessionQuestionId,
        answer.occurrenceNo,
        answer.selectedOptionId,
        sqlTime(answer.shownAt),
        sqlTime(answer.deadlineAt),
        sqlTime(answer.answeredAt),
        answer.responseMs,
        answer.outcome,
        JSON.stringify(answer.question.optionIds),
      ]);

      await updateProgress(
        db,
        userId,
        answer.question,
        inserted.insertId,
        answer,
      );
    }

    await db.execute(`
      UPDATE game_sessions
      SET
        player_hp = ?,
        enemy_hp = ?,
        status = ?,
        result = ?,
        active_duration_ms = ?,
        finished_at = CASE
          WHEN ? = 'active' THEN NULL
          ELSE UTC_TIMESTAMP(6)
        END
      WHERE id = ? AND user_id = ?
    `, [
      playerHp,
      foxHp,
      status,
      battleResult,
      duration,
      status,
      game.id,
      userId,
    ]);

    return {
      sessionId: String(game.id),
      status,
      result: battleResult,
    };
  });

  res.json(result);
});

// Список для будущего экрана статистики.
// cursor — id последней строки предыдущей страницы.
router.get('/', async (req, res) => {
  const userId = res.locals.userId;
  const cursor = req.query.cursor;

  requireValue(
    cursor === undefined || validId(cursor),
    'Некорректный курсор.',
  );

  const parameters = cursor === undefined
    ? [userId]
    : [userId, cursor];

  const [games] = await pool.execute(`
    SELECT
      CAST(game.id AS CHAR) AS id,
      game.status,
      game.result,
      game.initial_hp AS initialHp,
      game.answer_seconds AS answerSeconds,
      game.question_order AS questionOrder,
      game.player_hp AS playerHp,
      game.enemy_hp AS foxHp,
      game.active_duration_ms AS activeDurationMs,
      DATE_FORMAT(
        game.started_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS startedAt,
      DATE_FORMAT(
        game.finished_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS finishedAt,
      COALESCE(totals.correct_count, 0) AS correctCount,
      COALESCE(totals.wrong_count, 0) AS wrongCount,
      COALESCE(totals.timeout_count, 0) AS timeoutCount
    FROM game_sessions AS game
    LEFT JOIN (
      SELECT
        sets.session_id,
        SUM(answer.outcome = 'correct') AS correct_count,
        SUM(answer.outcome = 'wrong') AS wrong_count,
        SUM(answer.outcome = 'timeout') AS timeout_count
      FROM session_sets AS sets
      JOIN session_questions AS question
        ON question.session_set_id = sets.id
      JOIN session_answers AS answer
        ON answer.session_question_id = question.id
      GROUP BY sets.session_id
    ) AS totals ON totals.session_id = game.id
    WHERE game.user_id = ?
      ${cursor === undefined ? '' : 'AND game.id < ?'}
    ORDER BY game.id DESC
    LIMIT 50
  `, parameters);

  res.json({
    games,
    nextCursor: games.length === 50
      ? games[games.length - 1].id
      : null,
  });
});

// Подробности одного боя, включая снимки вопросов и ответы.
router.get('/:id', async (req, res) => {
  const data = await transaction(async db => {
    const snapshot = await readGame(
      db,
      req.params.id,
      res.locals.userId,
    );

    const [answers] = await db.execute(`
      SELECT
        CAST(answer.id AS CHAR) AS id,
        CAST(answer.session_question_id AS CHAR) AS sessionQuestionId,
        CAST(answer.selected_option_id AS CHAR) AS selectedOptionId,
        answer.outcome,
        answer.occurrence_no AS occurrenceNo,
        answer.elapsed_ms AS responseMs,
        DATE_FORMAT(
          answer.shown_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS shownAt,
        DATE_FORMAT(
          answer.deadline_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS deadlineAt,
        DATE_FORMAT(
          answer.answered_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS answeredAt
      FROM session_answers AS answer
      JOIN session_questions AS question
        ON question.id = answer.session_question_id
      JOIN session_sets AS sets
        ON sets.id = question.session_set_id
      WHERE sets.session_id = ?
      ORDER BY answer.id
    `, [snapshot.game.id]);

    return {
      ...publicGame(snapshot),
      answers,
    };
  });

  res.json(data);
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (!error.status) {
    console.error('Ошибка игры:', error.code || error.message);
  }

  return res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : 'Не удалось сохранить игру. Попробуй ещё раз.',
  });
});

module.exports = router;
