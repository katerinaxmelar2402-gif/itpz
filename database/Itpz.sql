USE knowledge_trainer;

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO question_sets (
  author_id,
  title,
  description,
  creation_method,
  visibility,
  content_status,
  system_code,
  created_at,
  updated_at
)
VALUES (
  NULL,
  'Итопиз',
  'Разные темы',
  'Попробуй тренажёр: 15 вопросов из разных областей знаний.',
  'manual',
  'public',
  'ready',
  'itopiz-demo',
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP(6)
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @collection_id = (
  SELECT id
  FROM question_sets
  WHERE system_code = 'itopiz-demo'
);

-- correct — номер правильного варианта, начиная с 1.
SET @demo_questions = '[
  {
    "text": "Как правильно пишется слово «в..н..грет»?",
    "options": ["Винигрет", "Венегрет", "Винегрет", "Венигрет"],
    "correct": 3
  },
  {
    "text": "Сколько будет 34 + 87?",
    "options": ["111", "121", "131", "120"],
    "correct": 2
  },
  {
    "text": "Какой город является столицей Японии?",
    "options": ["Пекин", "Сеул", "Киото", "Токио"],
    "correct": 4
  },
  {
    "text": "Какой орган человека перекачивает кровь по кровеносным сосудам?",
    "options": ["Сердце", "Печень", "Желудок", "Лёгкие"],
    "correct": 1
  },
  {
    "text": "Какая планета является шестой от Солнца?",
    "options": ["Марс", "Юпитер", "Сатурн", "Нептун"],
    "correct": 3
  },
  {
    "text": "Какой вариант соответствует ПДД РФ: какие огни используют для обозначения движущегося легкового автомобиля днём?",
    "options": [
      "Только габаритные огни",
      "Ближний свет фар или дневные ходовые огни",
      "Только аварийную сигнализацию",
      "Обязательно дальний свет фар"
    ],
    "correct": 2
  },
  {
    "text": "В каком году началась Великая Отечественная война?",
    "options": ["1939", "1940", "1945", "1941"],
    "correct": 4
  },
  {
    "text": "Как образуется множественное число английского слова child?",
    "options": ["Children", "Childs", "Childes", "Childrens"],
    "correct": 1
  },
  {
    "text": "Каким химическим символом обозначают золото?",
    "options": ["Ag", "Fe", "Au", "Cu"],
    "correct": 3
  },
  {
    "text": "Какое устройство предназначено для ввода текста в компьютер?",
    "options": ["Монитор", "Клавиатура", "Принтер", "Колонки"],
    "correct": 2
  },
  {
    "text": "Кто написал произведение «Капитанская дочка»?",
    "options": [
      "Лев Толстой",
      "Николай Гоголь",
      "Михаил Лермонтов",
      "Александр Пушкин"
    ],
    "correct": 4
  },
  {
    "text": "Сколько основных названий нот в последовательности до, ре, ми, фа, соль, ля, си?",
    "options": ["7", "5", "6", "8"],
    "correct": 1
  },
  {
    "text": "Чему равна сумма внутренних углов треугольника на плоскости?",
    "options": ["90°", "180°", "270°", "360°"],
    "correct": 2
  },
  {
    "text": "В каких единицах в системе СИ измеряют силу?",
    "options": ["Ватт", "Паскаль", "Ньютон", "Джоуль"],
    "correct": 3
  },
  {
    "text": "Какой газ растения поглощают из воздуха при фотосинтезе?",
    "options": ["Кислород", "Водород", "Гелий", "Углекислый газ"],
    "correct": 4
  }
]';

INSERT INTO questions (set_id, text, position)
SELECT @collection_id, source.question_text, source.question_position
FROM JSON_TABLE(
  @demo_questions,
  '$[*]' COLUMNS (
    question_position FOR ORDINALITY,
    question_text VARCHAR(500) PATH '$.text'
  )
) AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM questions AS existing
  WHERE existing.set_id = @collection_id
    AND existing.position = source.question_position
);

INSERT INTO answer_options (question_id, text, is_correct)
SELECT
  question.id,
  source.option_text,
  source.option_position = source.correct_option
FROM JSON_TABLE(
  @demo_questions,
  '$[*]' COLUMNS (
    question_position FOR ORDINALITY,
    correct_option INT PATH '$.correct',
    NESTED PATH '$.options[*]' COLUMNS (
      option_position FOR ORDINALITY,
      option_text VARCHAR(200) PATH '$'
    )
  )
) AS source
JOIN questions AS question
  ON question.set_id = @collection_id
 AND question.position = source.question_position
WHERE NOT EXISTS (
  SELECT 1
  FROM answer_options AS existing
  WHERE existing.question_id = question.id
    AND existing.text = source.option_text
);

COMMIT;

-- Проверка: должно получиться 15 вопросов и 60 вариантов ответа.
SELECT
  collection.title,
  COUNT(DISTINCT question.id) AS question_count,
  COUNT(answer.id) AS option_count
FROM question_sets AS collection
JOIN questions AS question ON question.set_id = collection.id
JOIN answer_options AS answer ON answer.question_id = question.id
WHERE collection.system_code = 'itopiz-demo'
GROUP BY collection.id, collection.title;