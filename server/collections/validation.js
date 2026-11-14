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

module.exports = { readTitle, readCollection };
