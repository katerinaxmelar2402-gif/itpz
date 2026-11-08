//Регистрирует аккаунт, проверяет пароль, выдаёт токен на семь дней, проверяет сессию и погашает её при выходе. 
// Регистрация требует имя, почту, пароль от 6 символов и согласие. 
// Значение `course-v1` — метка версии согласия для учебного запуска.
const { Router } = require('express');
const { createHash, randomBytes } = require('node:crypto');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('./password');

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!emailPattern.test(email) || email.length > 254) return null;
  if (typeof password !== 'string' || !password || password.length > 128) return null;
  return { email, password };
}

async function createSession(db, user) {
  const token = randomBytes(32).toString('hex');

  await db.execute(
    `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
     VALUES (?, ?, 'session', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))`,
    [user.id, tokenHash(token)],
  );

  return { token, user: { name: user.name, email: user.email } };
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(req) {
  return /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '')?.[1];
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/register', async (req, res) => {
  const data = credentials(req.body);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!data || data.password.length < 6 || !name || name.length > 100 || req.body?.consent !== true) {
    return res.status(400).json({ message: 'Проверьте имя, почту, пароль от 6 символов и согласие.' });
  }
  const passwordHash = await hashPassword(data.password);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO users (email, password_hash, name, status, consent_at, policy_version, created_at)
       VALUES (?, ?, ?, 'active', UTC_TIMESTAMP(), 'course-v1', UTC_TIMESTAMP())`,
      [data.email, passwordHash, name],
    );

    const session = await createSession(connection, {
      id: result.insertId,
      name,
      email: data.email,
    });

    await connection.commit();
    res.status(201).json(session);
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Аккаунт с такой почтой уже существует.' });
    }

    throw error;
  } finally {
    connection.release();
  }
});

router.post('/login', async (req, res) => {
  const data = credentials(req.body);
  const invalid = { message: 'Неверная почта или пароль.' };
  if (!data) return res.status(401).json(invalid);

  const [rows] = await pool.execute(
    `SELECT id, name, email, password_hash FROM users
     WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [data.email],
  );
  const user = rows[0];
  const verified = await verifyPassword(data.password, user?.password_hash);
  if (!user || !verified) return res.status(401).json(invalid);

    res.json(await createSession(pool, user));
});

router.get('/me', async (req, res) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Требуется вход.' });

  const [rows] = await pool.execute(
    `SELECT u.name, u.email FROM auth_tokens AS t
     JOIN users AS u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.purpose = 'session'
       AND t.revoked_at IS NULL AND t.expires_at > UTC_TIMESTAMP()
       AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`,
    [tokenHash(token)],
  );
  if (!rows[0]) return res.status(401).json({ message: 'Сессия завершена. Войдите снова.' });
  res.json({ user: rows[0] });
});

router.post('/logout', async (req, res) => {
  const token = readToken(req);
  if (token) {
    await pool.execute(
      `UPDATE auth_tokens SET revoked_at = UTC_TIMESTAMP()
       WHERE token_hash = ? AND purpose = 'session' AND revoked_at IS NULL`,
      [tokenHash(token)],
    );
  }
  res.status(204).end();
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ message: 'Некорректный запрос.' });
  }
  console.error('Ошибка API авторизации:', error.code || error.name);
  res.status(500).json({ message: 'Ошибка сервера. Попробуйте ещё раз.' });
});

module.exports = router;