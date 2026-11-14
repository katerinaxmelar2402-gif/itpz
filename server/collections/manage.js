const { Router } = require('express');
const pool = require('../db');
const { readCollection } = require('./validation');

const router = Router();

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function findCollection(db, id, userId, lock = false) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw httpError(404, 'Коллекция не найдена.');
  }
  const [rows] = await db.execute(`
    SELECT collection.*,
      DATE_FORMAT(collection.updated_at, '%Y%m%d%H%i%s%f') AS version,
      EXISTS (
        SELECT 1 FROM set_connections
        WHERE user_id = ? AND set_id = collection.id
      ) AS is_connected
    FROM question_sets AS collection
    WHERE collection.id = ? AND collection.deleted_at IS NULL
      AND collection.content_status = 'ready'
    ${lock ? 'FOR UPDATE' : ''}
  `, [userId, id]);
  const row = rows[0];
  const isOwner = row && String(row.author_id) === String(userId);
  if (!row || (!isOwner && row.system_code === null && !row.is_connected)) {
    throw httpError(404, 'Коллекция не найдена или больше недоступна.');
  }
  return { ...row, isOwner };
}

async function readQuestions(db, setId) {
  const [rows] = await db.execute(`
    SELECT question.id, question.text, answer.id AS answer_id,
      answer.text AS answer_text, answer.is_correct
    FROM questions AS question
    LEFT JOIN answer_options AS answer ON answer.question_id = question.id
    WHERE question.set_id = ? AND question.deleted_at IS NULL
    ORDER BY question.position, question.id, answer.id
  `, [setId]);
  const questions = new Map();
  for (const row of rows) {
    const id = String(row.id);
    if (!questions.has(id)) {
      questions.set(id, { id, text: row.text, answers: [], correctIndex: null });
    }
    const question = questions.get(id);
    if (row.answer_id !== null) {
      if (row.is_correct) question.correctIndex = question.answers.length;
      question.answers.push(row.answer_text);
    }
  }
  return [...questions.values()];
}

function sendError(res, error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'У тебя уже есть коллекция с таким названием.',
    });
  }
  if (!error.status) console.error('Ошибка коллекции:', error.code || error.message);
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Не удалось выполнить действие. Попробуй ещё раз.',
  });
}

router.get('/:id', async (req, res) => {
  // Одна транзакция даёт согласованную версию названия и вопросов.
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const row = await findCollection(db, req.params.id, res.locals.userId);
    const questions = await readQuestions(db, row.id);
    await db.commit();
    res.json({
      collection: {
        id: String(row.id),
        title: row.title,
        version: row.version,

        isBuiltIn: row.system_code !== null,
        isPublic: row.visibility === 'public',
        isOwner: row.isOwner,

        canEdit: row.isOwner && row.system_code === null,
        canDelete: row.isOwner && row.system_code === null,

        accessKey: row.visibility === 'public'
          ? row.access_key
          : null,

        questions,
      },
    });
  } catch (error) {
    await db.rollback();
    sendError(res, error);
  } finally {
    db.release();
  }
});

router.put('/:id', async (req, res) => {
  let data;
  try {
    data = readCollection(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const row = await findCollection(db, req.params.id, res.locals.userId, true);
    if (!row.isOwner || row.system_code !== null) {
      throw httpError(403, 'Можно редактировать только свои коллекции.');
    }
    if (req.body.version !== row.version) {
      throw httpError(409, 'Коллекция уже изменилась. Открой её заново перед редактированием.');
    }
    const existing = new Map((await readQuestions(db, row.id)).map(q => [q.id, q]));
    const retained = new Set();
    for (const [index, question] of data.questions.entries()) {
      const sourceId = req.body.questions[index].sourceId;
      if (sourceId != null) {
        const id = String(sourceId);
        if (!existing.has(id) || retained.has(id)) {
          throw httpError(400, 'Некорректный список вопросов. Открой коллекцию заново.');
        }
        retained.add(id);
      }
    }
    await db.execute(`
      UPDATE question_sets SET title = ?, updated_at = NOW(6) WHERE id = ?
    `, [data.title, row.id]);
    for (const question of existing.values()) {
      if (!retained.has(question.id)) {
        await db.execute('UPDATE questions SET deleted_at = NOW() WHERE id = ?', [question.id]);
      }
    }
    for (const [index, question] of data.questions.entries()) {
      let id = req.body.questions[index].sourceId;
      const old = id == null ? null : existing.get(String(id));
      const changed = !old || old.text !== question.text
        || old.correctIndex !== question.correctIndex
        || JSON.stringify(old.answers) !== JSON.stringify(question.answers);
      if (old) {
        await db.execute(`
          UPDATE questions SET text = ?, position = ?, revision = revision + ? WHERE id = ?
        `, [question.text, index + 1, changed ? 1 : 0, id]);
      } else {
        const [result] = await db.execute(
          'INSERT INTO questions (set_id, text, position) VALUES (?, ?, ?)',
          [row.id, question.text, index + 1],
        );
        id = result.insertId;
      }
      if (changed) {
        await db.execute('DELETE FROM answer_options WHERE question_id = ?', [id]);
        for (const [answerIndex, text] of question.answers.entries()) {
          await db.execute(
            'INSERT INTO answer_options (question_id, text, is_correct) VALUES (?, ?, ?)',
            [id, text, answerIndex === question.correctIndex],
          );
        }
      }
    }
    await db.commit();
    res.json({ collection: { id: String(row.id) } });
  } catch (error) {
    await db.rollback();
    sendError(res, error);
  } finally {
    db.release();
  }
});

router.delete('/:id', async (req, res) => {
  const db = await pool.getConnection();

  try {
    await db.beginTransaction();

    const row = await findCollection(
      db,
      req.params.id,
      res.locals.userId,
      true,
    );

    if (!row.isOwner || row.system_code !== null) {
      throw httpError(
        403,
        'Удалять можно только свои коллекции.',
      );
    }

    await db.execute(
      `
      UPDATE question_sets
      SET
        deleted_at = NOW(),
        updated_at = NOW(6),
        access_key = NULL
      WHERE id = ?
      `,
      [row.id],
    );

    await db.commit();

    res.status(204).end();
  } catch (error) {
    await db.rollback();
    sendError(res, error);
  } finally {
    db.release();
  }
});

module.exports = router;
