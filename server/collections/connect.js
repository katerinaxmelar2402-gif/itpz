const { Router } = require('express');
const pool = require('../db');

const router = Router();

function readKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{48}$/.test(key)) {
    throw Object.assign(new Error('Вставь публичный ключ целиком: 48 букв и цифр.'), { status: 400 });
  }
  return key;
}

async function findByKey(db, key, userId, lock = false) {
  const [rows] = await db.execute(`
    SELECT collection.id, collection.title, collection.description,
      collection.author_id, collection.system_code, author.name AS author_name,
      (SELECT COUNT(*) FROM questions
        WHERE set_id = collection.id AND deleted_at IS NULL) AS question_count,
      EXISTS (SELECT 1 FROM set_connections
        WHERE user_id = ? AND set_id = collection.id) AS is_connected
    FROM question_sets AS collection
    LEFT JOIN users AS author ON author.id = collection.author_id
    WHERE collection.access_key = ? AND collection.visibility = 'public'
      AND collection.content_status = 'ready' AND collection.deleted_at IS NULL
    LIMIT 1 ${lock ? 'FOR UPDATE' : ''}
  `, [userId, key]);
  const row = rows[0];
  if (!row) {
    throw Object.assign(new Error('Набор не найден. Проверь ключ: автор мог закрыть доступ или удалить набор.'), { status: 404 });
  }
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    author: row.system_code !== null ? 'Итопиз' : row.author_name || 'Автор набора',
    questionCount: Number(row.question_count),
    alreadyAdded: String(row.author_id) === String(userId)
      || row.system_code !== null || Boolean(row.is_connected),
  };
}

function sendError(res, error) {
  if (!error.status) console.error('Ошибка подключения набора:', error.code || error.message);
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Не удалось подключить набор. Попробуй ещё раз.',
  });
}

// Предпросмотр не даёт доступ к вопросам и не добавляет набор в коллекции.
router.post('/lookup', async (req, res) => {
  try {
    const key = readKey(req.body?.accessKey);
    res.json({ collection: await findByKey(pool, key, res.locals.userId) });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/connect', async (req, res) => {
  let db;
  try {
    const key = readKey(req.body?.accessKey);
    db = await pool.getConnection();
    await db.beginTransaction();
    // Повторно проверяем ключ и блокируем набор от удаления/смены доступа.
    const collection = await findByKey(db, key, res.locals.userId, true);
    if (!collection.alreadyAdded) {
      await db.execute(`
        INSERT INTO set_connections (user_id, set_id, connected_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE set_id = set_id
      `, [res.locals.userId, collection.id]);
    }
    await db.commit();
    res.json({ collection });
  } catch (error) {
    if (db) await db.rollback();
    sendError(res, error);
  } finally {
    if (db) db.release();
  }
});

module.exports = router;
