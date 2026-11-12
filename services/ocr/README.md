# PaddleOCR worker

The backend sends each receipt to a persistent CPU worker. Models load once,
and each image uses one detection/recognition pipeline instead of 21 Tesseract
passes. Indonesian Latin recognition and English receipt text share the Latin
recognition model. The worker returns reading-order text and average confidence
on the existing 0–100 scale. Raw OCR remains stored on the receipt.

Start or rebuild with `docker compose up -d --build ocr backend`.
The first start downloads models; subsequent starts use the `paddleocr_models`
volume. Docker Compose waits for OCR readiness before starting the backend.
For a backend running outside Docker, set `OCR_BASE_URL=http://localhost:8000`.

The endpoint accepts image bytes at `POST /recognize`, up to 20 MB. The backend
allows 60 seconds per OCR request. The worker runs one inference at a time;
concurrent uploads receive HTTP 503 and follow the existing failed-receipt flow.
Image EXIF rotation and text-line orientation are supported; full document
orientation and unwarping are disabled to reduce work for upright screenshots.

Run worker tests with `python -m unittest discover -s services/ocr`.
Run actual inference and image validation checks with
`docker compose exec -T ocr python smoke_test.py` (synthetic receipt only).
Measure warm OCR and AI latency separately using their backend logs. Accuracy
and end-to-end speed depend on the receipt image and CPU; OCR changes do not
remove remote AI latency.
