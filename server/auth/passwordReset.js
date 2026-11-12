//Отправка кода и смена пароля в транзакции
const { createHmac, randomInt, timingSafeEqual } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { Router } = require('express');
const pool = require('../db');
const { hashPassword } = require('./password');
const { sendResetCode } = require('./resetMail');

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxAttempts = 5;
const genericMessage = 'Если аккаунт с этой почтой существует, мы отправим код.';
const invalidCode = 'Код неверен или истёк. Запроси новый код.';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isEmail(email) {
  return email.length <= 254 && emailPattern.test(email);
}

function digest(userId, code) {
  return createHmac('sha256', process.env.RESET_CODE_SECRET)
    .update(userId + ':' + code)
    .digest('hex');
}

async function inTransaction(work) {
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

async function findUserForUpdate(db, email) {
  const [rows] = await db.execute(
    `SELECT id, email FROM users
     WHERE email = ? AND status = 'active' AND deleted_at IS NULL
     FOR UPDATE`,
    [email],
  );
  return rows[0];
}

async function issueCode(email) {
  const delivery = await inTransaction(async db => {
    const user = await findUserForUpdate(db, email);
    if (!user) return null;

    const [recent] = await db.execute(
      'SELECT user_id FROM password_resets WHERE user_id = ? AND resend_after > UTC_TIMESTAMP()',
      [user.id],
    );
    if (recent.length) return null;

    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const hash = digest(user.id, code);
    await db.execute(
      `INSERT INTO password_resets (user_id, code_hash, expires_at, resend_after, attempts)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
               DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 MINUTE), 0)
       ON DUPLICATE KEY UPDATE
         code_hash = ?, expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
         resend_after = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 MINUTE), attempts = 0`,
      [user.id, hash, hash],
    );
    return { email: user.email, code };
  });

  if (delivery) await sendResetCode(delivery.email, delivery.code);
}

const limit = count => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: count,
  message: { message: 'Слишком много попыток. Попробуй позже.' },
});

router.post('/forgot-password', limit(5), (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isEmail(email)) return res.status(400).json({ message: 'Введи корректную почту.' });
  if (!process.env.RESEND_API_KEY || !process.env.RESET_FROM || !process.env.RESET_CODE_SECRET) {
    return res.status(503).json({ message: 'Восстановление пароля временно недоступно.' });
  }

  res.status(202).json({ message: genericMessage });
  issueCode(email).catch(error => {
    console.error('Ошибка отправки кода восстановления:', error.code || error.name);
  });
});

router.post('/reset-password', limit(30), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { code, password } = req.body ?? {};
  if (!isEmail(email) || typeof code !== 'string' || !/^\d{8}$/.test(code) ||
      typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ message: 'Проверь почту, восьмизначный код и новый пароль.' });
  }
  if (!process.env.RESET_CODE_SECRET) {
    return res.status(503).json({ message: 'Восстановление пароля временно недоступно.' });
  }

  const changed = await inTransaction(async db => {
    const user = await findUserForUpdate(db, email);
    if (!user) return false;

    const [rows] = await db.execute(
      `SELECT code_hash, attempts FROM password_resets
       WHERE user_id = ? AND expires_at > UTC_TIMESTAMP()`,
      [user.id],
    );
    const reset = rows[0];
    if (!reset || reset.attempts >= maxAttempts) return false;

    const supplied = Buffer.from(digest(user.id, code), 'hex');
    const expected = Buffer.from(reset.code_hash, 'hex');
    if (!timingSafeEqual(supplied, expected)) {
      await db.execute(
        'UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?',
        [user.id],
      );
      return false;
    }

    const passwordHash = await hashPassword(password);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await db.execute(
      'UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL',
      [user.id],
    );
    await db.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    return true;
  });

  if (!changed) return res.status(400).json({ message: invalidCode });
  res.json({ message: 'Пароль обновлён. Теперь войди с новым паролем.' });
});

module.exports = router;