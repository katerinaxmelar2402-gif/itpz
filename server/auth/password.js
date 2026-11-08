//Хеширует пароль при регистрации и проверяет его при входе
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummySalt = randomBytes(16);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, options);
  return salt.toString('hex') + ':' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  const valid = typeof stored === 'string' && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored);
  const [saltHex, keyHex] = valid ? stored.split(':') : [];
  const salt = valid ? Buffer.from(saltHex, 'hex') : dummySalt;
  const expected = valid ? Buffer.from(keyHex, 'hex') : Buffer.alloc(64);
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, expected) && valid;
}

module.exports = { hashPassword, verifyPassword };