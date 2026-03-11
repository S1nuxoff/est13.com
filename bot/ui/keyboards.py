from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def services_kb(
    services: list[tuple[int, str]],
    *,
    columns: int = 1,
    footer_buttons: list[tuple[str, str]] | None = None,
) -> InlineKeyboardMarkup:
    cols = max(int(columns), 1)
    rows: list[list[InlineKeyboardButton]] = []

    row: list[InlineKeyboardButton] = []
    for service_id, title in services:
        row.append(InlineKeyboardButton(text=title, callback_data=f"svc:{service_id}"))
        if len(row) >= cols:
            rows.append(row)
            row = []
    if row:
        rows.append(row)

    if footer_buttons:
        for text, cb in footer_buttons:
            rows.append([InlineKeyboardButton(text=text, callback_data=cb)])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def options_kb(options: list[tuple[int, str, int, int]]) -> InlineKeyboardMarkup:
    # Backward-compatible default: if all options have (row=0,col=0), render one button per row.
    if options and all(int(row) == 0 and int(col) == 0 for _, _, row, col in options):
        rows = [[InlineKeyboardButton(text=text, callback_data=f"opt:{option_id}")] for option_id, text, _, _ in options]
        return InlineKeyboardMarkup(inline_keyboard=rows)

    # Group options by row, then sort within each row by col.
    by_row: dict[int, list[tuple[int, str, int]]] = {}
    for option_id, text, row, col in options:
        by_row.setdefault(int(row), []).append((int(col), option_id, text))

    rows: list[list[InlineKeyboardButton]] = []
    for row in sorted(by_row.keys()):
        items = sorted(by_row[row], key=lambda x: (x[0], x[1]))
        rows.append(
            [InlineKeyboardButton(text=text, callback_data=f"opt:{option_id}") for _, option_id, text in items]
        )

    return InlineKeyboardMarkup(inline_keyboard=rows)


def nav_rows(
    *,
    show_back: bool = True,
    show_cancel: bool = True,
    back_text: str = "⬅️ Назад",
    cancel_text: str = "Скасувати",
) -> list[list[InlineKeyboardButton]]:
    row: list[InlineKeyboardButton] = []
    if show_back:
        row.append(InlineKeyboardButton(text=back_text, callback_data="lead:back"))
    if show_cancel:
        row.append(InlineKeyboardButton(text=cancel_text, callback_data="lead:cancel"))
    return [row] if row else []


def cancel_kb(*, cancel_text: str = "Скасувати") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=nav_rows(show_back=False, show_cancel=True, cancel_text=cancel_text))
