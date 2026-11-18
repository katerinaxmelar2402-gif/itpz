const { Router } = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const { gigachat } = require('../ai/gigachat');
const { generateQuestions } = require('./generation');
const { readTitle } = require('./validation');
const pool = require('../db');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 200000,
} }).single('file');
const busy = new Set();
router.post('/generate', rateLimit({ windowMs: 10 * 60 * 1000, limit: 10,
  keyGenerator: (req, res) => String(res.locals.userId),
  message: { message: 'Слишком много генераций. Повтори через 10 минут.' } }),
  (req, res, next) => upload(req, res, error => error
    ? res.status(400).json({ message: 'Не удалось загрузить файл. Максимальный размер — 10 МБ.' }) : next()),
  async (req, res) => {
    const userId = String(res.locals.userId);
    if (busy.has(userId)) return res.status(409).json({ message: 'Предыдущая генерация ещё выполняется.' });
    busy.add(userId);
    req.setTimeout(600000);
    res.setTimeout(600000);
    try {
      const title = readTitle(req.body?.title);
      const count = Number(req.body?.count);
      if (!Number.isInteger(count) || count < 5 || count > 20) throw new Error('Выбери от 5 до 20 вопросов.');
      const [existing] = await pool.execute(
        'SELECT id FROM question_sets WHERE author_id = ? AND active_title = ? LIMIT 1', [userId, title]);
      if (existing.length) return res.status(409).json({ message: 'Коллекция с таким названием уже существует.' });
      let text = req.body?.text || '';
      if (req.file) {
        const extension = req.file.originalname.split('.').pop().toLowerCase();
        try {
          if (extension === 'txt') text = new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer);
          else if (extension === 'docx') text = (await require('mammoth').extractRawText({ buffer: req.file.buffer })).value;
          else if (extension === 'pdf') text = (await require('pdf-parse')(req.file.buffer)).text;
          else throw new Error('format');
        } catch {
          throw new Error('Не удалось прочитать файл. Нужен TXT в UTF-8, DOCX или PDF с текстом, без пароля.');
        }
      }
      const questions = await generateQuestions(text, count, (messages, options) => gigachat.chat(messages, options));
      res.json({ title, questions });
    } catch (error) {
      // Не возвращаем внутренние ошибки MySQL или содержимое запросов.
      const internal = error.sql || error.code?.startsWith('ER_');
      res.status(internal ? 500 : 422).json({ message: internal
        ? 'Ошибка базы данных. Попробуй позже.' : error.message });
    } finally { busy.delete(userId); }
  });
module.exports = router;
