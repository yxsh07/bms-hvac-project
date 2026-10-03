FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn numpy
COPY . /app

FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY --from=builder /app /app
EXPOSE 8000
CMD ["uvicorn", "sim:app", "--host", "0.0.0.0", "--port", "8000"]
