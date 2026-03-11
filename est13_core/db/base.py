from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Ensure all models are imported so their tables are present in Base.metadata.
# This avoids runtime issues with ForeignKey resolution when some model modules
# are imported without their referenced targets being loaded.
from est13_core.db import models as _models  # noqa: E402,F401
