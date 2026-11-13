const { Router } = require('express');
const { randomBytes } = require('node:crypto');

const pool = require('../db');

const router = Router();

const LIMITS = {
  title: 100,
  question: 500,
  answer: 200,
  minQuestions: 5,
  maxQuestions: 20,
  minAnswers: 2,
  maxAnswers: 6,
};

function cleanText(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim()
    : '';
}

function readTitle(value) {
  const title = cleanText(value);

  if (
    !title
    || title.length > LIMITS.title
    || /[\r\n]/.test(title)
  ) {
    throw new Error(
      'Введите название коллекции длиной от 1 до 100 символов.',
    );
  }

  return title;
}

function readCollection(body) {
  const title = readTitle(body?.title);
  const questions = body?.questions;

  if (
    !Array.isArray(questions)
    || questions.length < LIMITS.minQuestions
    || questions.length > LIMITS.maxQuestions
  ) {
    throw new Error('В коллекции должно быть от 5 до 20 вопросов.');
  }

  const prepared = questions.map((question, questionIndex) => {
    const text = cleanText(question?.text);
    const number = questionIndex + 1;

    if (!text || text.length > LIMITS.question) {
      throw new Error(
        `Вопрос ${number}: введите от 1 до 500 символов.`,
      );
    }

    if (
      !Array.isArray(question.answers)
      || question.answers.length < LIMITS.minAnswers
      || question.answers.length > LIMITS.maxAnswers
    ) {
      throw new Error(
        `Вопрос ${number}: нужно от 2 до 6 вариантов ответа.`,
      );
    }

    const answers = question.answers.map(cleanText);

    if (
      answers.some(answer =>
        !answer
        || answer.length > LIMITS.answer
        || /[\r\n]/.test(answer)
      )
    ) {
      throw new Error(
        `Вопрос ${number}: заполните ответы, до 200 символов в одну строку.`,
      );
    }

    const uniqueAnswers = new Set(
      answers.map(answer => answer.toLocaleLowerCase('ru-RU')),
    );

    if (uniqueAnswers.size !== answers.length) {
      throw new Error(
        `Вопрос ${number}: варианты ответа должны различаться.`,
      );
    }

    const correctIndex = question.correctIndex;

    if (
      !Number.isInteger(correctIndex)
      || correctIndex < 0
      || correctIndex >= answers.length
    ) {
      throw new Error(
        `Вопрос ${number}: выберите один правильный ответ.`,
      );
    }

    return { text, answers, correctIndex };
  });

  const accessKey = body.accessKey ?? null;

  if (
    accessKey !== null
    && (
      typeof accessKey !== 'string'
      || !/^[a-f0-9]{48}$/.test(accessKey)
    )
  ) {
    throw new Error('Некорректный публичный ключ.');
  }

  return { title, questions: prepared, accessKey };
}

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
    LIMIT 1
    `,
    [res.locals.userId, title],
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
        VALUES (?, ?, 'manual', ?, 'ready', ?, NOW(), NOW(6))
        `,
        [
            res.locals.userId,
            collection.title,
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