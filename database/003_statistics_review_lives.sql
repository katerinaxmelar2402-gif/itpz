-- Общая работа над ошибками может включать вопросы нескольких коллекций.
ALTER TABLE game_sessions
  MODIFY initial_hp SMALLINT NOT NULL,
  MODIFY player_hp SMALLINT NOT NULL,
  MODIFY enemy_hp SMALLINT NOT NULL;
