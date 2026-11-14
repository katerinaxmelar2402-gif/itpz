const { Router } = require('express');
const pool = require('../db');
const { readToken, findSessionUser } = require('../auth/sessions');
const createRoutes = require('./create');
const manageRoutes = require('./manage');

const router = Router();

router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  const token = readToken(req);
  const user = token ? await findSessionUser(pool, token) : null;

  if (!user) {
    return res.status(401).json({
      message: 'Сессия истекла. Войдите в аккаунт снова.',
    });
  }

  res.locals.userId = user.id;
  next();
});

router.get('/', async (req, res) => {
  const userId = res.locals.userId;

  const [rows] = await pool.execute(
    `
    WITH question_counts AS (
      SELECT set_id, COUNT(*) AS question_count
      FROM questions
      WHERE deleted_at IS NULL
      GROUP BY set_id
    ),
    game_totals AS (
      SELECT
        ss.set_id,
        game.id AS session_id,
        game.initial_hp,
        game.answer_seconds,
        game.question_order,
        game.finished_at,
        SUM(CASE WHEN answer.outcome = 'correct' THEN 1 ELSE 0 END)
          AS correct_count,
        SUM(CASE WHEN answer.outcome IN ('wrong', 'timeout') THEN 1 ELSE 0 END)
          AS error_count
      FROM game_sessions AS game
      JOIN session_sets AS ss ON ss.session_id = game.id
      LEFT JOIN session_questions AS question
        ON question.session_set_id = ss.id
      LEFT JOIN session_answers AS answer
        ON answer.session_question_id = question.id
      WHERE game.user_id = ?
        AND game.status = 'completed'
        AND game.finished_at IS NOT NULL
        AND ss.visible_in_statistics = 1
      GROUP BY
        ss.set_id,
        game.id,
        game.initial_hp,
        game.answer_seconds,
        game.question_order,
        game.finished_at
    ),
    ranked_games AS (
      SELECT
        game_totals.*,
        ROW_NUMBER() OVER (
          PARTITION BY set_id
          ORDER BY finished_at DESC, session_id DESC
        ) AS recent_position
      FROM game_totals
    )
    SELECT
      collection.id,
      collection.title,
      collection.description,
      collection.system_code,
      collection.author_id,
      collection.visibility,
      DATE_FORMAT(
        COALESCE(
            (
            SELECT connection.connected_at
            FROM set_connections AS connection
            WHERE connection.user_id = ?
                AND connection.set_id = collection.id
            ),
            collection.created_at
        ),
        '%Y-%m-%dT%H:%i:%s.%f'
      ) AS added_at,
      COALESCE(counts.question_count, 0) AS question_count,
      recent.session_id,
      recent.initial_hp,
      recent.answer_seconds,
      recent.question_order,
      DATE_FORMAT(
        recent.finished_at,
        '%Y-%m-%dT%H:%i:%s.%fZ'
      ) AS finished_at,
      recent.correct_count,
      recent.error_count
    FROM question_sets AS collection
    LEFT JOIN question_counts AS counts ON counts.set_id = collection.id
    LEFT JOIN ranked_games AS recent
      ON recent.set_id = collection.id
     AND recent.recent_position = 1
    WHERE collection.deleted_at IS NULL
      AND collection.content_status = 'ready'
      AND (
        collection.system_code IS NOT NULL
        OR collection.author_id = ?
        OR EXISTS (
          SELECT 1
          FROM set_connections AS connection
          WHERE connection.user_id = ?
            AND connection.set_id = collection.id
        )
      )
    ORDER BY
      (collection.system_code IS NOT NULL) DESC,
      collection.title,
      collection.id
    `,
    [userId, userId, userId, userId],
  );

  const [history] = await pool.execute(
    `
    SELECT EXISTS (
      SELECT 1
      FROM game_sessions
      WHERE user_id = ?
        AND status = 'completed'
        AND finished_at IS NOT NULL
    ) AS has_played
    `,
    [userId],
  );

  res.json({
    hasPlayed: Boolean(history[0].has_played),
    collections: rows.map(row => ({
      id: String(row.id),
      title: row.title,
      addedAt: row.added_at,
      description: row.description,
      questionCount: Number(row.question_count),
      isBuiltIn: row.system_code !== null,
      isOwner: String(row.author_id) === String(userId),
      isPublic: row.visibility === 'public',
      lastGame: row.session_id === null ? null : {
        sessionId: String(row.session_id),
        initialHp: Number(row.initial_hp),
        answerSeconds: Number(row.answer_seconds),
        questionOrder: row.question_order,
        finishedAt: row.finished_at,
        correctCount: Number(row.correct_count),
        errorCount: Number(row.error_count),
      },
    })),
  });
});

router.use('/', createRoutes);
router.use('/', manageRoutes);
module.exports = router;

//Завершённая игра: status = completed
//Правильный ответ: outcome = correct
//Неправильный ответ: outcome = wrong
//Время закончилось: outcome = timeout
