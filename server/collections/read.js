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
        SELECT 1
        FROM set_connections
        WHERE user_id = ? AND set_id = collection.id
      ) AS is_connected
    FROM question_sets AS collection
    WHERE collection.id = ?
      AND collection.deleted_at IS NULL
      AND collection.content_status = 'ready'
    ${lock ? 'FOR UPDATE' : ''}
  `, [userId, id]);

  const row = rows[0];
  const isOwner = row && String(row.author_id) === String(userId);

  if (
    !row
    || (
      !isOwner
      && row.system_code === null
      && (row.visibility !== 'public' || !row.is_connected)
    )
  ) {
    throw httpError(
      404,
      'Коллекция не найдена или больше недоступна.',
    );
  }

  return { ...row, isOwner };
}

async function readQuestions(db, setId) {
  const [rows] = await db.execute(`
    SELECT
      question.id,
      question.text,
      question.revision,
      answer.id AS answer_id,
      answer.text AS answer_text,
      answer.is_correct
    FROM questions AS question
    LEFT JOIN answer_options AS answer
      ON answer.question_id = question.id
    WHERE question.set_id = ?
      AND question.deleted_at IS NULL
    ORDER BY question.position, question.id, answer.id
  `, [setId]);

  const questions = new Map();

  for (const row of rows) {
    const id = String(row.id);

    if (!questions.has(id)) {
      questions.set(id, {
        id,
        text: row.text,
        revision: Number(row.revision),
        answers: [],
        correctIndex: null,
      });
    }

    const question = questions.get(id);

    if (row.answer_id !== null) {
      if (row.is_correct) {
        question.correctIndex = question.answers.length;
      }

      question.answers.push(row.answer_text);
    }
  }

  return [...questions.values()];
}

module.exports = {
  httpError,
  findCollection,
  readQuestions,
};
