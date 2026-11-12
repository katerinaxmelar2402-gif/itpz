//Выдает пару токенов, обновляет короткий токен и отзывает токены, если пользователь вышел из системы
const { createHash, randomBytes } = require('node:crypto');

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(req) {
  return /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '')?.[1];
}

async function createSession(db, user) {
  const token = randomBytes(32).toString('hex');
  const refreshToken = randomBytes(32).toString('hex');

  await db.execute(
    `INSERT INTO auth_sessions (user_id, access_hash, refresh_hash, access_expires_at, refresh_expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
             DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY))`,
    [user.id, tokenHash(token), tokenHash(refreshToken)],
  );

  return { token, refreshToken, user: { id: user.id, name: user.name, email: user.email } };
}

async function findSessionUser(db, token, lock = false) {
  const [rows] = await db.execute(
    `SELECT u.id, u.name, u.email FROM auth_sessions AS s
     JOIN users AS u ON u.id = s.user_id
     WHERE s.access_hash = ? AND s.revoked_at IS NULL
       AND s.access_expires_at > UTC_TIMESTAMP()
       AND s.refresh_expires_at > UTC_TIMESTAMP()
       AND u.status = 'active' AND u.deleted_at IS NULL
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [tokenHash(token)],
  );
  return rows[0];
}

async function refreshSession(db, refreshToken) {
  const token = randomBytes(32).toString('hex');
  const refreshHash = tokenHash(refreshToken);
  const [result] = await db.execute(
    `UPDATE auth_sessions AS s JOIN users AS u ON u.id = s.user_id
     SET s.access_hash = ?,
         s.access_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
         s.refresh_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY)
     WHERE s.refresh_hash = ? AND s.revoked_at IS NULL
       AND s.refresh_expires_at > UTC_TIMESTAMP() AND u.status = 'active' AND u.deleted_at IS NULL`,
    [tokenHash(token), refreshHash],
  );
  if (!result.affectedRows) return null;

  const [rows] = await db.execute(
    `SELECT u.id, u.name, u.email FROM auth_sessions AS s
     JOIN users AS u ON u.id = s.user_id
     WHERE s.refresh_hash = ? AND s.revoked_at IS NULL
       AND s.refresh_expires_at > UTC_TIMESTAMP() AND u.status = 'active' AND u.deleted_at IS NULL`,
    [refreshHash],
  );
  return rows[0] ? { token, refreshToken, user: rows[0] } : null;
}

async function revokeSession(db, token) {
  const hash = tokenHash(token);
  await db.execute(
    `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
     WHERE (refresh_hash = ? OR access_hash = ?) AND revoked_at IS NULL`,
    [hash, hash],
  );
}

async function revokeOtherSessions(db, userId, accessToken) {
  await db.execute(
    `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
     WHERE user_id = ? AND access_hash <> ? AND revoked_at IS NULL`,
    [userId, tokenHash(accessToken)],
  );
}

module.exports = { createSession, findSessionUser, readToken, refreshSession, revokeSession, revokeOtherSessions };