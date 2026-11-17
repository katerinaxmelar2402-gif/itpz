import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'itpz.battle.v2:';

let localQueue = Promise.resolve();

const uploads = new Map();

/** @template T @param {() => Promise<T>} work @returns {Promise<T>} */
function localOperation(work) {
  const operation = localQueue.then(work);

  localQueue = operation.then(() => {}, () => {});
  return operation;
}

function recordRank(record) {
  const statusRank = record.status === 'completed'
    ? 2
    : record.status === 'abandoned'
      ? 1
      : 0;

  return record.answers.length * 3 + statusRank;
}

function upload(key, request) {
  if (uploads.has(key)) return uploads.get(key);

  const operation = (async () => {
    while (true) {
      const envelope = await localOperation(async () => {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      });

      if (!envelope?.pending) return;

      const snapshot = JSON.stringify(envelope.record);

      await request(
        `/games/${encodeURIComponent(envelope.record.serverSessionId)}`,
        {
          method: 'PUT',
          body: envelope.record,
        },
      );

      await localOperation(async () => {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;

        const latest = JSON.parse(raw);

        // Пока шёл запрос, мог появиться следующий ответ.
        // В таком случае новую запись ещё нужно отправить.
        if (JSON.stringify(latest.record) === snapshot) {
          await AsyncStorage.setItem(
            key,
            JSON.stringify({
              ...latest,
              pending: false,
            }),
          );
        }
      });
    }
  })().finally(() => {
    uploads.delete(key);
  });

  uploads.set(key, operation);
  return operation;
}

export async function saveBattle(record, request) {
  const snapshot = JSON.parse(JSON.stringify(record));

  const key = `${PREFIX}${snapshot.userId}:${snapshot.serverSessionId}`;

  try {
    await localOperation(async () => {
      const raw = await AsyncStorage.getItem(key);
      const previous = raw ? JSON.parse(raw) : null;

      // Защита от запоздавшего сохранения более старого состояния.
      if (
        previous
        && recordRank(previous.record) > recordRank(snapshot)
      ) {
        return;
      }

      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          record: snapshot,
          pending: true,
        }),
      );
    });
  } catch {
    throw new Error('Не удалось сохранить результаты на устройстве.');
  }

  try {
    await upload(key, request);
  } catch {
    throw new Error(
      'Результаты сохранены на устройстве, '
      + 'но пока не отправлены на сервер. Повтори отправку.',
    );
  }
}

export async function syncPendingBattles(userId, request) {
  const prefix = `${PREFIX}${userId}:`;

  const keys = await localOperation(async () =>
    (await AsyncStorage.getAllKeys())
      .filter(key => key.startsWith(prefix)),
  );

  const results = await Promise.allSettled(
    keys.map(key => upload(key, request)),
  );

  const failed = results.find(result => result.status === 'rejected');

  if (failed) throw failed.reason;
}
