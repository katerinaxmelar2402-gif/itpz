ALTER TABLE question_sets
  ADD COLUMN active_title VARCHAR(255)
    GENERATED ALWAYS AS (
      CASE
        WHEN deleted_at IS NULL THEN LOWER(TRIM(title))
        ELSE NULL
      END
    ) STORED,
  ADD UNIQUE KEY uq_sets_author_active_title (
    author_id,
    active_title
  );