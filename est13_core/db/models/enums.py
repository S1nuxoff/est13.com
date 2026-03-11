from __future__ import annotations

import enum


class QuestionType(str, enum.Enum):
    text = "text"
    single_choice = "single_choice"
    phone = "phone"
    email = "email"


class LeadStatus(str, enum.Enum):
    # Client flow
    filling = "filling"  # клієнт проходить бриф
    abandoned = "abandoned"  # клієнт почав, але кинув
    awaiting_review = "awaiting_review"  # анкету надіслано, але ще не переглядали
    in_review = "in_review"  # адмін переглядає

    # Studio work
    confirmed = "confirmed"  # можна брати в роботу
    in_work = "in_work"  # робота виконується
    paused = "paused"  # пауза / очікуємо клієнта

    # Negative outcomes
    rejected = "rejected"  # заявка не підходить
    lost = "lost"  # клієнт пропав
    studio_cancelled = "studio_cancelled"  # скасовано зі сторони студії

    # Final
    done = "done"  # робота виконана
    delivered = "delivered"  # передано клієнту
    client_not_confirmed = "client_not_confirmed"  # клієнт не підтвердив
    closed = "closed"  # закрито


class AdminRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"


class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class LeadSource(str, enum.Enum):
    bot = "bot"
    webapp = "webapp"
