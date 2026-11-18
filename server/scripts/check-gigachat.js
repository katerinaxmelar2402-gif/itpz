// Запуск из server: npm run ai:models или npm run ai:check.
require('../bootstrap-tls');
const { gigachat } = require('../ai/gigachat');

async function main() {
  const mode = process.argv[2];
  if (mode === '--models') {
    const models = await gigachat.listModels();
    console.log('Подключение работает. Доступные модели:');
    for (const model of models) console.log(`  ${model}`);
    if (!models.length) console.log('Список пуст. Проверь доступ в кабинете GigaChat API.');
    return;
  }
  if (mode !== '--chat') throw new Error('Используй npm run ai:models или npm run ai:check.');
  console.log('Отправляем короткий тестовый запрос (расходует токены API)…');
  const reply = await gigachat.chat([
    { role: 'system', content: 'Отвечай кратко на русском языке. Не вызывай внешние инструменты.' },
    { role: 'user', content: 'Напиши одну фразу: Подключение к GigaChat работает.' },
  ]);
  console.log('Ответ GigaChat:');
  console.log(reply);
}

main().catch(error => {
  console.error(`Ошибка${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  process.exitCode = 1;
});
