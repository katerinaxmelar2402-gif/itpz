const express = require('express');
const pool = require('./db');
const authRoutes = require('./auth/routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS connected');

    res.json({
      server: 'ok',
      database: rows[0].connected === 1 ? 'connected' : 'unknown',
    });
  } catch (error) {
    console.error('Ошибка подключения к БД:', error.code);

    res.status(503).json({
      message: 'Не удалось подключиться к базе данных',
    });
  }
});

app.use('/api/auth', express.json({ limit: '8kb' }), authRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`Сервер запущен: http://127.0.0.1:${port}`);
});