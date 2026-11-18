require('../bootstrap-tls');
const { gigachat, createGigaChatClient } = require('../ai/gigachat');
const { generateQuestions } = require('../collections/generation');

// Только проверка API. Не читает пользовательские файлы и не меняет БД.
const notes = 'Android — операционная система для мобильных устройств. '
  + 'Открытая часть Android называется Android Open Source Project (AOSP). '
  + 'Производители устройств могут добавлять к Android собственные компоненты. '
  + 'Google распространяет пакет Google Mobile Services (GMS). '
  + 'В GMS входят Google Play, YouTube, Gmail и Maps. '
  + 'Пакет GMS не является частью Android Open Source Project. '
  + 'На устройстве Android пакет GMS может отсутствовать. '
  + 'На смартфонах Huawei используются Huawei Mobile Services (HMS) и магазин AppGallery.';

const client = process.argv.includes('--network-debug') ? createGigaChatClient({
  fetchImpl: async (url, options) => {
    try { return await fetch(url, options); }
    catch (error) {
      // Только адрес сервиса и коды сети, без ключей и текста запросов.
      console.error('Сеть:', new URL(url).hostname, error.cause?.code || error.name);
      throw error;
    }
  },
}) : gigachat;

generateQuestions(notes, 5, (messages, options) => client.chat(messages, options))
  .then(questions => {
    console.log(`Готово: ${questions.length} вопросов. Формат и ссылки на фрагменты проверены. Проверь смысл вопросов вручную.`);
    for (const q of questions) console.log(q.text);
  })
  .catch(error => { console.error(error.message); process.exitCode = 1; });
