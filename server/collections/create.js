const { Router } = require('express');
const { randomBytes } = require('node:crypto');

const pool = require('../db');

const router = Router();

const { readTitle, readCollection } = require('./validation');

// Предварительная проверка названия.
// Окончательную защиту обеспечивает уникальный индекс в MySQL.
router.post('/check-title', async (req, res) => {
  let title;

  try {
    title = readTitle(req.body?.title);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const [rows] = await pool.execute(
    `
    SELECT id
    FROM question_sets
    WHERE author_id = ?
      AND active_title = ?
      AND id <> ?
    LIMIT 1
    `,
    [res.locals.userId, title, /^\d+$/.test(String(req.body?.excludeId)) ? String(req.body.excludeId) : '0'],
  );

  if (rows.length > 0) {
    return res.status(409).json({
      message: 'У тебя уже есть коллекция с таким названием.',
    });
  }

  res.json({ available: true });
});

// Ключ пока только создаётся.
// Доступ к коллекции появится после её сохранения.
router.post('/key', (req, res) => {
  res.json({
    accessKey: randomBytes(24).toString('hex'),
  });
});

router.post('/', async (req, res) => {
  let collection;

  try {
    collection = readCollection(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
        `
        INSERT INTO question_sets (
            author_id,
            title,
            creation_method,
            visibility,
            content_status,
            access_key,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, 'ready', ?, NOW(), NOW(6))
        `,
        [
            res.locals.userId,
            collection.title,
            req.body?.creationMethod === 'notes' ? 'notes' : 'manual',
            collection.accessKey ? 'public' : 'private',
            collection.accessKey,
        ],
    );

    const setId = result.insertId;

    for (const [index, question] of collection.questions.entries()) {
      const [questionResult] = await connection.execute(
        `
        INSERT INTO questions (
          set_id,
          text,
          position
        )
        VALUES (?, ?, ?)
        `,
        [setId, question.text, index + 1],
      );

      for (const [answerIndex, answer] of question.answers.entries()) {
        await connection.execute(
          `
          INSERT INTO answer_options (
            question_id,
            text,
            is_correct
          )
          VALUES (?, ?, ?)
          `,
          [
            questionResult.insertId,
            answer,
            answerIndex === question.correctIndex,
          ],
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      collection: {
        id: String(setId),
        title: collection.title,
        questionCount: collection.questions.length,
        accessKey: collection.accessKey,
      },
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      const isTitleConflict = String(error.sqlMessage)
        .includes('uq_sets_author_active_title');

      return res.status(409).json({
        message: isTitleConflict
          ? 'У тебя уже есть коллекция с таким названием.'
          : 'Этот ключ уже занят. Создай новый публичный ключ.',
      });
    }

    console.error('Ошибка создания коллекции:', error.code);

    res.status(500).json({
      message: 'Не удалось сохранить коллекцию. Попробуй ещё раз.',
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
