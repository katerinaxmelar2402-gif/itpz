const { test } = require('node:test');
const assert = require('node:assert/strict');

test('файл сохраняет реальное имя, остаётся File и отдаёт исходные байты без Blob', async () => {
  const { namedUploadFile } = await import('./uploadFile.mjs');
  let reads = 0;
  class NativeFile {
    constructor(uri) { this.uri = uri; }
    get name() { return '123456'; }
    async bytes() { reads += 1; return new Uint8Array([0, 255, 12]); }
  }
  const file = namedUploadFile(NativeFile, 'content://documents/123456', 'Экономика.docx');
  assert.ok(file instanceof NativeFile);
  assert.equal(file.name, 'Экономика.docx');
  assert.equal(file.uri, 'content://documents/123456');
  assert.equal(reads, 0);
  assert.deepEqual(await file.bytes(), new Uint8Array([0, 255, 12]));
  assert.equal(reads, 1);
});
