FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (will include backend, plus we copy the dataset in docker-compose)
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV REDIS_HOST=cache
ENV PORT=8000

EXPOSE 8000

# Initialize schema, ingest data, and start server
CMD python database/schema.py && python ingestion/ingest.py && uvicorn main:app --host 0.0.0.0 --port 8000
