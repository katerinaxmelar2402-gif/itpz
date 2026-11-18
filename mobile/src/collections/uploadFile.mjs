// Передаём сам File: Expo умеет читать его bytes(), глобальный RN Blob не нужен.
export function namedUploadFile(FileClass, uri, name) {
  const file = new FileClass(uri);
  Object.defineProperty(file, 'name', { value: name, configurable: true });
  return file;
}
