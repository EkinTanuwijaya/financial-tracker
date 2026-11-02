FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY services/ocr/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ocr/ ./
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
