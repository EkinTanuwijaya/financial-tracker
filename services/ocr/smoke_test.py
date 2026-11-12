import io
import json
import time
import urllib.error
import urllib.request
from PIL import Image, ImageDraw, ImageFont


def main():
    image = Image.new("RGB", (1000, 600), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=36)
    for index, line in enumerate([
        "OCTO Mobile", "Transfer Berhasil", "Tanggal: 28/03/2025",
        "Total: Rp 1.600.000,50", "Catatan: Belanja toko",
    ]):
        draw.text((40, 40 + index * 80), line, font=font, fill="black")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    for attempt in range(2):
        started = time.monotonic()
        request = urllib.request.Request(
            "http://localhost:8000/recognize", data=buffer.getvalue(),
            headers={"Content-Type": "application/octet-stream"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
        assert "1.600.000,50" in result["text"], result
        assert "28/03/2025" in result["text"], result
        assert "OCTO" in result["text"], result
        assert 0 <= result["confidence"] <= 100, result
        print(json.dumps({"run": attempt + 1, "seconds": round(time.monotonic() - started, 3), **result}))

    for body, expected in [(b"invalid image", 400), (b"", 413)]:
        try:
            urllib.request.urlopen(urllib.request.Request("http://localhost:8000/recognize", data=body), timeout=10)
        except urllib.error.HTTPError as error:
            assert error.code == expected, error.code
        else:
            raise AssertionError(f"Expected HTTP {expected}")
    print("Image validation checks passed")


if __name__ == "__main__":
    main()
