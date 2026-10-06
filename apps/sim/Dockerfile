# SimSite API and mock gateway (PLAN §2.1, §6).
# Build context is the repository root so data/ and apps/sim keep their layout:
# sim/profile.py resolves the repo root as parents[3] from its own path.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY apps/sim/requirements.txt ./apps/sim/requirements.txt
RUN pip install --no-cache-dir -r apps/sim/requirements.txt

COPY apps/sim ./apps/sim
COPY data ./data

EXPOSE 8000

CMD ["uvicorn", "sim.app:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "apps/sim"]
