import { ConfigService } from "@nestjs/config";
import { OcrService } from "./ocr.service";

describe("OcrService", () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const service = new OcrService(new ConfigService({ OCR_BASE_URL: "http://ocr:8000/" }));

  beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
  afterAll(() => { global.fetch = originalFetch; });

  it("sends one image request and preserves OCR text and percentage confidence", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "Total Rp 16.000,00", confidence: 98.2 })));
    await expect(service.recognize(Buffer.from([1, 2, 3]))).resolves.toEqual({
      text: "Total Rp 16.000,00", confidence: 98.2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://ocr:8000/recognize", expect.objectContaining({
      method: "POST", body: new Uint8Array([1, 2, 3]), signal: expect.any(AbortSignal),
    }));
  });

  it("propagates worker failure", async () => {
    fetchMock.mockResolvedValue(new Response("error", { status: 503 }));
    await expect(service.recognize(Buffer.from("image"))).rejects.toThrow("PaddleOCR HTTP 503");
  });

  it.each([
    { text: null, confidence: 90 },
    { text: "receipt", confidence: "90" },
    { text: "receipt", confidence: 101 },
    { text: "receipt", confidence: -1 },
  ])("rejects an invalid result: %j", async (result) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result)));
    await expect(service.recognize(Buffer.from("image"))).rejects.toThrow("Invalid PaddleOCR response");
  });
});
