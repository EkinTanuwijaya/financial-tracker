import io
import json
import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from concurrent.futures import ThreadPoolExecutor

MAX_BYTES = 20 * 1024 * 1024
engine = None
executor = None
inference_lock = threading.Lock()


def extract_result(results):
    lines, scores = [], []
    for result in results:
        for text, score in zip(result["rec_texts"], result["rec_scores"]):
            if text.strip():
                lines.append(text.strip())
                scores.append(float(score))
    return {
        "text": "\n".join(lines),
        "confidence": round(sum(scores) / len(scores) * 100, 2) if scores else 0,
    }


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == "/health" else 404,
                   {"ready": engine is not None})

    def do_POST(self):
        if self.path != "/recognize":
            self.reply(404, {"error": "Not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.reply(400, {"error": "Invalid content length"})
            return
        if not 0 < size <= MAX_BYTES:
            self.reply(413, {"error": "Image must be between 1 byte and 20 MB"})
            return
        from PIL import Image, ImageOps, UnidentifiedImageError
        import numpy as np

        Image.MAX_IMAGE_PIXELS = 20_000_000
        self.connection.settimeout(15)
        try:
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(self.rfile.read(size))))
            image = np.asarray(image.convert("RGB"))[:, :, ::-1].copy()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            self.reply(400, {"error": "Invalid or oversized image"})
            return
        if not inference_lock.acquire(blocking=False):
            self.reply(503, {"error": "OCR busy; retry shortly"})
            return
        try:
            started = time.monotonic()
            # Paddle predictors must stay on the same thread across requests.
            result = extract_result(executor.submit(engine.predict, image).result())
            logging.info("OCR completed in %.2fs", time.monotonic() - started)
        except Exception:
            logging.exception("OCR failed")
            self.reply(500, {"error": "OCR inference failed"})
            return
        finally:
            inference_lock.release()
        self.reply(200, result)


def create_engine():
    from paddleocr import PaddleOCR

    return PaddleOCR(
        device="cpu",
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
        cpu_threads=4,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executor = ThreadPoolExecutor(max_workers=1)
    engine = executor.submit(create_engine).result()
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
