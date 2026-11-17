USE knowledge_trainer;

ALTER TABLE game_sessions
  ADD COLUMN client_key VARCHAR(80)
    CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD UNIQUE KEY uq_game_sessions_user_client_key (
    user_id,
    client_key
  );