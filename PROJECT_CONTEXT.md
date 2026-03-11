# Контекст проєкту: Est13 Bot

Цей файл фіксує поточний стан репозиторію: архітектуру, структуру, ключові рішення та правила роботи.

## Що це за проєкт

Система для веб‑студії Est13:
- **Telegram‑бот** збирає **ліди** (заявки) через сценарії питань.
- **Адмінка** дозволяє редагувати тексти, конструктор форм (flow), переглядати ліди та аналітику.
- Уся контент‑логіка (питання/відповіді/переходи/тексти) зберігається в **PostgreSQL** і змінюється без редеплою бота.

Технології:
- Bot: `aiogram v3`
- DB: `PostgreSQL` + `SQLAlchemy (async)`
- Migrations: `Alembic`
- Admin API: `FastAPI`
- Admin UI: `React + Vite + TypeScript + Tailwind` + `@xyflow/react` (React Flow)

Мова інтерфейсу адмінки: **українська**.

## Структура репозиторію

- `src/est13_bot/` — Telegram‑бот + бізнес‑логіка + DB‑моделі/репозиторії
- `src/est13_api/` — FastAPI бекенд для адмінки (CRUD + аналітика)
- `alembic/` — міграції БД
- `est13_admin/` — React/Vite фронтенд адмінки
- `.env` — локальні змінні середовища (не комітити токени)

## Як працює бот (важливо)

Бот проходить питання **тільки за явними переходами** (`next_question_id`):
- `questions.next_question_id` — перехід “після питання”
- `question_options.next_question_id` — перехід “після вибраного варіанту”

Якщо для поточного кроку **немає переходу** → сценарій завершується (лід переходить у стан “надіслано” / завершено).

Це зроблено спеціально, щоб “останнє питання” без зв’язку **не задавалось** автоматично.

## База даних (основні сутності)

- `services` — послуги (форми): сайт, бот, логотип тощо
- `questions` — питання в межах послуги
- `question_options` — варіанти для `single_choice`
- `leads` — заявка користувача
- `lead_answers` — відповіді в заявці
- `bot_texts` — ключ → текст (вітання, підказки, повідомлення)
- `users` — користувачі Telegram
- `admin_users` — адміни (для сповіщень/ролей, якщо потрібно)

### Архівація (замість видалення)

Історія лідів важливіша за “чистоту” форм.
Тому питання/варіанти, які вже потрапили в історію (`lead_answers`), **не видаляються**, а **архівуються**:
- `questions.is_archived = true`
- `question_options.is_archived = true`

В адмінці архів прихований за замовчуванням (є перемикач “Показати/Сховати архів”).

## Конструктор форм (Flow Builder)

Сторінка: **«Форми»**.

Особливості:
- Редактор **лише для ПК** (на телефоні показується повідомлення, що редактор недоступний).
- Редагування відбувається **прямо на полотні**: текст питання, тип, код, обов’язковість, варіанти.
- Переходи створюються лініями (edges) між нодами.
- “Відв’язування проводка” підтримується:
  - кнопкою `X` на вибраному ребрі
  - клавішами `Delete` / `Backspace`
- Позиції нод зберігаються в БД: `questions.pos_x`, `questions.pos_y`.

## Адмін API (FastAPI)

Файл: `src/est13_api/main.py`

Авторизація (опційно):
- якщо задано `ADMIN_API_TOKEN`, кожен запит має містити заголовок `X-Admin-Token`

Основні ендпоїнти:
- `GET /api/health`
- `GET /api/dashboard?days=30` — метрики для дашборду
- `GET /api/services`, `POST /api/services`, `PATCH /api/services/{id}`, `DELETE /api/services/{id}` (delete = вимкнути)
- `GET /api/services/{id}/questions`, `POST /api/services/{id}/questions`
- `PATCH /api/questions/{id}`, `DELETE /api/questions/{id}` (видалення → архів/очищення посилань)
- `POST /api/questions/{id}/options`, `PATCH /api/options/{id}`, `DELETE /api/options/{id}`
- `GET /api/texts`, `POST /api/texts`, `PUT /api/texts/{key}`, `DELETE /api/texts/{key}`
- `GET /api/leads`, `GET /api/leads/{id}`, `PATCH /api/leads/{id}/status`

## Адмін UI (React/Vite)

Папка: `est13_admin/`

Навігація: **ліва бокова панель**.
Сторінки:
- `Дашборд` — статистика та аналітика
- `Форми` — конструктор сценаріїв
- `Тексти` — ключ → значення (будь‑які повідомлення бота)
- `Ліди` — список заявок, перегляд і зміна статусу
- `Налаштування` — API base / токен

## Глосарій полів (що означає “Порядок” і “Значення”)

- **Порядок** (`sort`) — число для сортування. Менше число → вище/раніше.
  - використовується для порядку послуг/питань/варіантів у списках
  - не є логікою переходів (переходи задаються тільки лінками)
- **Значення** (`value`) у варіантах — що саме буде збережено як відповідь.
  - **Текст** — що бачить користувач у кнопці/варіанті
  - **Значення** — що записується в `lead_answers.answer` (можна лишати порожнім)

## Локальний запуск без Docker (Windows PowerShell)

### 1) Підготувати venv і залежності
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Міграції БД
```powershell
python -m alembic upgrade head
```

### 3) Запуск бота
Потрібно, щоб `src` був у `PYTHONPATH`:
```powershell
$env:PYTHONPATH = \"$PWD\\src\"
python -m est13_bot
```

### 4) Запуск Admin API
Використовуйте `python -m uvicorn` (щоб не залежати від PATH):
```powershell
$env:PYTHONPATH = \"$PWD\\src\"
python -m uvicorn est13_api.main:app --host 127.0.0.1 --port 8000
```

### 5) Запуск адмінки (UI)
```powershell
cd est13_admin
npm run dev
```

## Змінні середовища (.env)

Мінімально потрібні:
- `BOT_TOKEN` — токен Telegram‑бота
- `DATABASE_URL` — DSN до PostgreSQL (`postgresql+asyncpg://...`)

Опційно:
- `ADMIN_TG_IDS` — Telegram ID адмінів (для сповіщень)
- `ADMIN_API_TOKEN` — токен для захисту Admin API

