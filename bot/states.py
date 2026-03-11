from aiogram.fsm.state import State, StatesGroup


class LeadStates(StatesGroup):
    collecting = State()

