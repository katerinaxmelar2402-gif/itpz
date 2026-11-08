//Проверяет поля до отправки формы. Сервер повторяет обязательные проверки со своей стороны.
/** @param {string} email @param {string} password */
export function validateCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Введите корректную электронную почту.';
  }
  if (!password) return 'Введите пароль.';
  return null;
}

/**
 * @param {string} name
 * @param {string} password
 * @param {string} confirmation
 * @param {boolean} consent
 */
export function validateRegistration(name, password, confirmation, consent) {
  if (!name.trim()) return 'Введите имя.';
  if (password.length < 6) return 'Пароль должен содержать от 6 символов.';
  if (password !== confirmation) return 'Пароли не совпадают.';
  if (!consent) return 'Подтвердите согласие на обработку данных.';
  return null;
}