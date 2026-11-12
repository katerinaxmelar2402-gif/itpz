// Регистрирует аккаунт, выдаёт токены и завершает сессии. 
// Регистрация требует имя, почту, пароль от 6 символов и согласие. 
// Значение `course-v1` — метка версии согласия для учебного запуска.
const { Router } = require('express');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('./password');
const { createSession, findSessionUser, readToken, refreshSession, revokeSession, revokeOtherSessions } = require('./sessions');
const passwordResetRoutes = require('./passwordReset');

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { rateLimit } = require('express-rate-limit');

function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!emailPattern.test(email) || email.length > 254) return null;
  if (typeof password !== 'string' || !password || password.length > 128) return null;
  return { email, password };
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
 
  //повторно проверяет версию хеша под блокировкой, чтобы параллельный запрос со старым паролем не смог создать сессию после сброса
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [current] = await connection.execute(
      `SELECT id FROM users WHERE id = ? AND BINARY password_hash = ?
       AND status = 'active' AND deleted_at IS NULL FOR UPDATE`,
      [user.id, user.password_hash],
    );
    if (!current.length) {
      await connection.rollback();
      return res.status(401).json(invalid);
    }

    const session = await createSession(connection, user);
    await connection.commit();
    res.json(session);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.get('/me', async (req, res) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Требуется вход.' });

  const user = await findSessionUser(pool, token);
  if (!user) return res.status(401).json({ message: 'Сессия завершена. Войдите снова.' });
  res.json({ user });
});

const profileLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: { message: 'Слишком много попыток. Попробуйте позже.' },
});

router.patch('/profile', profileLimit, async (req, res) => {
  const token = readToken(req);
  const signedIn = token && await findSessionUser(pool, token);
  const expired = { message: 'Сессия завершена. Войдите снова.' };

  if (!signedIn) return res.status(401).json(expired);

  const body = req.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const login = credentials({
    email: body.email,
    password: body.currentPassword,
  });
  const newPassword = body.newPassword ?? '';

  if (
    !name || name.length > 100 || !login ||
    typeof newPassword !== 'string' ||
    (newPassword !== '' && (newPassword.length < 6 || newPassword.length > 128))
  ) {
    return res.status(400).json({
      message: 'Проверьте имя, почту и пароли. Новый пароль должен содержать от 6 до 128 символов.',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, email, password_hash FROM users
       WHERE id = ? AND status = 'active' AND deleted_at IS NULL FOR UPDATE`,
      [signedIn.id],
    );
    const account = rows[0];

    if (!account || !(await findSessionUser(connection, token, true))) {
      await connection.rollback();
      return res.status(401).json(expired);
    }

    if (!(await verifyPassword(login.password, account.password_hash))) {
      await connection.rollback();
      return res.status(403).json({ message: 'Текущий пароль указан неверно.' });
    }

    const passwordHash = newPassword
      ? await hashPassword(newPassword)
      : account.password_hash;

    await connection.execute(
      'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?',
      [name, login.email, passwordHash, account.id],
    );

    if (newPassword || login.email !== account.email) {
      await revokeOtherSessions(connection, account.id, token);
      await connection.execute(
        'DELETE FROM password_resets WHERE user_id = ?',
        [account.id],
      );
    }

    await connection.commit();
    res.json({ user: { id: account.id, name, email: login.email } });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Эта почта уже используется.' });
    }
    throw error;
  } finally {
    connection.release();
  }
});

router.post('/refresh', async (req, res) => {
  const token = readToken(req);
  const session = token && await refreshSession(pool, token);
  if (!session) return res.status(401).json({ message: 'Сессия завершена. Войдите снова.' });
  res.json(session);
});

router.post('/logout', async (req, res) => {
  const token = readToken(req);
  if (token) await revokeSession(pool, token);
  res.status(204).end();
});

router.use(passwordResetRoutes);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ message: 'Некорректный запрос.' });
  }
  console.error('Ошибка API авторизации:', error.code || error.name);
  res.status(500).json({ message: 'Ошибка сервера. Попробуйте ещё раз.' });
});

module.exports = router;