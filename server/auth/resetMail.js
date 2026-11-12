async function sendResetCode(email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESET_FROM,
      to: [email],
      subject: 'Код восстановления пароля Итопиз',
      text: 'Твой код: ' + code + '\nКод действует 15 минут. Если ты его не запрашивал(а), никому не пересылай его и проигнорируй письмо.',
    }),
    signal: AbortSignal.timeout(10000),
  });

  await response.text();
  if (!response.ok) {
    const error = new Error('Resend отклонил запрос.');
    error.code = 'RESEND_' + response.status;
    throw error;
  }
}

module.exports = { sendResetCode };