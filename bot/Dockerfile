FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && pip install -r requirements.txt

COPY bot ./bot
COPY nardo_core ./nardo_core

RUN mkdir -p /app/data /app/data/media

CMD ["python", "-m", "bot"]
