// Node читает NODE_EXTRA_CA_CERTS только при старте процесса.
// Если переменную забыли задать, запускаем этот же скрипт с сертификатом проекта.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const certificate = path.join(__dirname, 'certs', 'gigachat-ca.pem');
if (!process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(certificate)) {
  console.log('Подключаем сертификат GigaChat из server/certs/gigachat-ca.pem.');
  const child = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate },
  });
  if (child.error) console.error('Не удалось перезапустить Node.js с сертификатом.');
  process.exit(child.status ?? 1);
}
