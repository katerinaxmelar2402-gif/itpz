USE knowledge_trainer;

SELECT
  author_id,
  LOWER(TRIM(title)) AS normalized_title,
  COUNT(*) AS collection_count
FROM question_sets
WHERE deleted_at IS NULL
  AND author_id IS NOT NULL
GROUP BY author_id, LOWER(TRIM(title))
HAVING COUNT(*) > 1;