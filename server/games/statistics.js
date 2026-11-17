// Последний обычный бой задаёт базу коллекции. Более поздние работы
// над ошибками заменяют только ответы на выбранные вопросы той же версии.
function summarizeStatistics(rows) {
  const sessions = new Map();
  for (const row of rows) {
    const sessionId = String(row.sessionId);
    if (!sessions.has(sessionId)) sessions.set(sessionId, {
      id: sessionId, mode: row.mode, startedAt: row.startedAt, collections: new Map(),
    });
    const session = sessions.get(sessionId);
    const collectionId = row.collectionId == null ? `deleted:${row.sessionSetId}` : String(row.collectionId);
    if (!session.collections.has(collectionId)) session.collections.set(collectionId, {
      id: collectionId, title: row.collectionTitle, questions: new Map(),
    });
    if (row.outcome == null) continue;
    const key = row.questionId == null ? `snapshot:${row.sessionQuestionId}`
      : `${row.questionId}:${row.revision}`;
    session.collections.get(collectionId).questions.set(key, {
      sessionQuestionId: String(row.sessionQuestionId),
      sourceSessionId: sessionId, collectionId,
      collectionTitle: row.collectionTitle,
      text: row.questionText, outcome: row.outcome,
    });
  }
  const ordered = [...sessions.values()].sort((a, b) =>
    String(a.startedAt).localeCompare(String(b.startedAt)) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const collections = new Map();
  const history = [];
  let played = 0;
  for (const session of ordered) {
    let total = 0;
    let correct = 0;
    for (const collection of session.collections.values()) {
      for (const question of collection.questions.values()) {
        total += 1;
        if (question.outcome === 'correct') correct += 1;
      }
      if (session.mode !== 'mistakes') {
        played += 1;
        collections.set(collection.id, { ...collection, questions: new Map(collection.questions) });
      } else {
        const current = collections.get(collection.id);
        if (!current) continue;
        for (const [key, question] of collection.questions) {
          if (current.questions.has(key)) current.questions.set(key, question);
        }
      }
    }
    if (total) history.push({ sessionId: session.id, date: session.startedAt,
      accuracy: Math.round(correct * 100 / total) });
  }
  const result = [...collections.values()].map(collection => {
    const questions = [...collection.questions.values()];
    const mistakes = questions.filter(question => question.outcome !== 'correct');
    const total = questions.length;
    return { id: collection.id, title: collection.title, total,
      wrong: mistakes.length, correct: total - mistakes.length,
      accuracy: total ? Math.round((total - mistakes.length) * 100 / total) : 0,
      mistakes };
  });
  const total = result.reduce((sum, collection) => sum + collection.total, 0);
  const wrong = result.reduce((sum, collection) => sum + collection.wrong, 0);
  return { played, total, wrong, accuracy: total ? Math.round((total - wrong) * 100 / total) : 0,
    collections: result, history: history.slice(-7), mistakes: result.flatMap(collection => collection.mistakes) };
}

async function readStatistics(db, userId) {
  const [rows] = await db.execute(`
    SELECT CAST(game.id AS CHAR) AS sessionId, game.mode,
      DATE_FORMAT(game.started_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS startedAt,
      CAST(sets.id AS CHAR) AS sessionSetId,
      CAST(sets.set_id AS CHAR) AS collectionId, sets.set_title_snapshot AS collectionTitle,
      CAST(question.id AS CHAR) AS sessionQuestionId,
      CAST(question.question_id AS CHAR) AS questionId,
      question.question_revision AS revision, question.text_snapshot AS questionText,
      answer.outcome
    FROM game_sessions AS game
    JOIN session_sets AS sets ON sets.session_id = game.id
    JOIN session_questions AS question ON question.session_set_id = sets.id
    LEFT JOIN session_answers AS answer ON answer.session_question_id = question.id
    WHERE game.user_id = ? AND game.status = 'completed' AND sets.visible_in_statistics = 1
    ORDER BY game.started_at, game.id, answer.id
  `, [userId]);
  return summarizeStatistics(rows);
}

module.exports = { summarizeStatistics, readStatistics };
