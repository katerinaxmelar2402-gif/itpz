
CREATE DATABASE `knowledge_trainer` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

USE `knowledge_trainer`;

CREATE TABLE `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(16) NOT NULL DEFAULT 'user',
  `status` VARCHAR(16) NOT NULL,
  `consent_at` DATETIME NOT NULL,
  `policy_version` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB;

CREATE TABLE auth_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  access_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  refresh_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  access_expires_at DATETIME NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_sessions_access_hash (access_hash),
  UNIQUE KEY uq_auth_sessions_refresh_hash (refresh_hash),
  KEY ix_auth_sessions_user_id (user_id),
  CONSTRAINT fk_auth_sessions_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `materials` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `owner_id` BIGINT NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `format` VARCHAR(4) NOT NULL,
  `size_bytes` BIGINT NOT NULL,
  `storage_key` VARCHAR(512) NOT NULL,
  `uploaded_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `generation_jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `material_id` BIGINT NOT NULL,
  `target_set_id` BIGINT NOT NULL,
  `requested_count` TINYINT NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `produced_count` TINYINT NULL,
  `error_code` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `set_connections` (
  `user_id` BIGINT NOT NULL,
  `set_id` BIGINT NOT NULL,
  `connected_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `set_id`)
) ENGINE=InnoDB;

CREATE TABLE `question_sets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `author_id` BIGINT NOT NULL,
  `source_material_id` BIGINT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `creation_method` VARCHAR(8) NOT NULL,
  `visibility` VARCHAR(8) NOT NULL,
  `content_status` VARCHAR(16) NOT NULL,
  `access_key` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME(6) NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sets_access_key` (`access_key`)
) ENGINE=InnoDB;

ALTER TABLE question_sets
  MODIFY COLUMN author_id BIGINT NULL,
  ADD COLUMN system_code VARCHAR(64) NULL,
  ADD UNIQUE KEY uq_question_sets_system_code (system_code);

CREATE TABLE `questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `set_id` BIGINT NOT NULL,
  `text` VARCHAR(500) NOT NULL,
  `position` SMALLINT NOT NULL,
  `revision` INT NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `answer_options` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `question_id` BIGINT NOT NULL,
  `text` VARCHAR(200) NOT NULL,
  `is_correct` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `game_sessions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `mode` VARCHAR(8) NOT NULL,
  `source_session_id` BIGINT NULL,
  `initial_hp` TINYINT NOT NULL,
  `answer_seconds` SMALLINT NOT NULL,
  `question_order` VARCHAR(8) NOT NULL,
  `player_hp` TINYINT NOT NULL,
  `enemy_hp` TINYINT NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `result` VARCHAR(16) NULL,
  `started_at` DATETIME(6) NOT NULL,
  `finished_at` DATETIME(6) NULL,
  `active_duration_ms` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `session_sets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_id` BIGINT NOT NULL,
  `set_id` BIGINT NULL,
  `set_title_snapshot` VARCHAR(255) NOT NULL,
  `visible_in_statistics` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `session_questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_set_id` BIGINT NOT NULL,
  `question_id` BIGINT NULL,
  `question_revision` INT NOT NULL,
  `text_snapshot` VARCHAR(500) NOT NULL,
  `initial_position` SMALLINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `session_options` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_question_id` BIGINT NOT NULL,
  `text_snapshot` VARCHAR(200) NOT NULL,
  `is_correct` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `question_progress` (
  `user_id` BIGINT NOT NULL,
  `question_id` BIGINT NOT NULL,
  `question_revision` INT NOT NULL,
  `has_unresolved_error` BOOLEAN NOT NULL,
  `last_error_answer_id` BIGINT NULL,
  `corrected_by_answer_id` BIGINT NULL,
  `updated_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`user_id`, `question_id`)
) ENGINE=InnoDB;

CREATE TABLE `session_answers` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_question_id` BIGINT NOT NULL,
  `occurrence_no` INT NOT NULL,
  `selected_option_id` BIGINT NULL,
  `shown_at` DATETIME(6) NOT NULL,
  `deadline_at` DATETIME(6) NOT NULL,
  `paused_remaining_ms` INT NULL,
  `answered_at` DATETIME(6) NULL,
  `elapsed_ms` INT NULL,
  `outcome` VARCHAR(16) NOT NULL,
  `display_option_order` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_answer_occurrence` (`session_question_id`, `occurrence_no`)
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  user_id BIGINT NOT NULL,
  code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_password_resets_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE `materials` ADD CONSTRAINT `fk_materials_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `question_sets` ADD CONSTRAINT `fk_question_sets_author_id` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `question_sets` ADD CONSTRAINT `fk_question_sets_source_material_id` FOREIGN KEY (`source_material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL;

ALTER TABLE `set_connections` ADD CONSTRAINT `fk_set_connections_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `set_connections` ADD CONSTRAINT `fk_set_connections_set_id` FOREIGN KEY (`set_id`) REFERENCES `question_sets` (`id`) ON DELETE RESTRICT;

ALTER TABLE `questions` ADD CONSTRAINT `fk_questions_set_id` FOREIGN KEY (`set_id`) REFERENCES `question_sets` (`id`) ON DELETE RESTRICT;

ALTER TABLE `answer_options` ADD CONSTRAINT `fk_answer_options_question_id` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE RESTRICT;

ALTER TABLE `generation_jobs` ADD CONSTRAINT `fk_generation_jobs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `generation_jobs` ADD CONSTRAINT `fk_generation_jobs_material_id` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE RESTRICT;

ALTER TABLE `generation_jobs` ADD CONSTRAINT `fk_generation_jobs_target_set_id` FOREIGN KEY (`target_set_id`) REFERENCES `question_sets` (`id`) ON DELETE RESTRICT;

ALTER TABLE `game_sessions` ADD CONSTRAINT `fk_game_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `game_sessions` ADD CONSTRAINT `fk_game_sessions_source_session_id` FOREIGN KEY (`source_session_id`) REFERENCES `game_sessions` (`id`) ON DELETE SET NULL;

ALTER TABLE `session_sets` ADD CONSTRAINT `fk_session_sets_session_id` FOREIGN KEY (`session_id`) REFERENCES `game_sessions` (`id`) ON DELETE RESTRICT;

ALTER TABLE `session_sets` ADD CONSTRAINT `fk_session_sets_set_id` FOREIGN KEY (`set_id`) REFERENCES `question_sets` (`id`) ON DELETE SET NULL;

ALTER TABLE `session_questions` ADD CONSTRAINT `fk_session_questions_session_set_id` FOREIGN KEY (`session_set_id`) REFERENCES `session_sets` (`id`) ON DELETE RESTRICT;

ALTER TABLE `session_questions` ADD CONSTRAINT `fk_session_questions_question_id` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE SET NULL;

ALTER TABLE `session_options` ADD CONSTRAINT `fk_session_options_session_question_id` FOREIGN KEY (`session_question_id`) REFERENCES `session_questions` (`id`) ON DELETE RESTRICT;

ALTER TABLE `session_answers` ADD CONSTRAINT `fk_session_answers_session_question_id` FOREIGN KEY (`session_question_id`) REFERENCES `session_questions` (`id`) ON DELETE RESTRICT;

ALTER TABLE `session_answers` ADD CONSTRAINT `fk_session_answers_selected_option_id` FOREIGN KEY (`selected_option_id`) REFERENCES `session_options` (`id`) ON DELETE SET NULL;

ALTER TABLE `question_progress` ADD CONSTRAINT `fk_question_progress_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `question_progress` ADD CONSTRAINT `fk_question_progress_question_id` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE RESTRICT;

ALTER TABLE `question_progress` ADD CONSTRAINT `fk_question_progress_last_error_answer_id` FOREIGN KEY (`last_error_answer_id`) REFERENCES `session_answers` (`id`) ON DELETE SET NULL;

ALTER TABLE `question_progress` ADD CONSTRAINT `fk_question_progress_corrected_by_answer_id` FOREIGN KEY (`corrected_by_answer_id`) REFERENCES `session_answers` (`id`) ON DELETE SET NULL;

SHOW TABLES;