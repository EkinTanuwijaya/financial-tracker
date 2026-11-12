import { GeminiProvider } from "./gemini.provider";
import { createProvider } from "./openai-compatible.provider";
import { TRANSACTION_SCHEMA } from "./ai.service";

describe("GeminiProvider", () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const config = { provider: "gemini", apiKey: "test-key", model: "gemini-3.8-flash" };
  const schema = { type: "object", properties: { amount: { type: "number" } }, required: ["amount"] };
  const success = () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [
    { text: "private reasoning", thought: true }, { text: '{"amount":' }, { text: "16000}" },
  ] } }] }));

  beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
  afterEach(() => { jest.useRealTimers(); });
  afterAll(() => { global.fetch = originalFetch; });

  it("uses native Gemini authentication, contents, and JSON schema while keeping 3.8 Flash", async () => {
    fetchMock.mockResolvedValue(success());
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(GeminiProvider);
    await expect(provider.complete("Total Rp 16.000", schema)).resolves.toEqual({ amount: 16000 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": "test-key" });
    const body = JSON.parse(options.body);
    expect(body.contents).toEqual([{ parts: [{ text: "Total Rp 16.000" }] }]);
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json", responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel: "low" },
    });
    expect(body.generationConfig.temperature).toBeUndefined();
    expect(body.messages).toBeUndefined();
    expect(body.tools).toBeUndefined();
  });

  it("preserves the generation settings for other Gemini models", async () => {
    fetchMock.mockResolvedValue(success());
    await createProvider({ ...config, model: "gemini-2.5-flash" }).complete("receipt", schema);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("sends the receipt currency constraint in Gemini's supported schema format", async () => {
    fetchMock.mockResolvedValue(success());
    await createProvider(config).complete("receipt", TRANSACTION_SCHEMA);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.responseJsonSchema.properties.currency).toEqual({ type: "string", enum: ["IDR"] });
  });

  it("does not retry invalid credentials", async () => {
    fetchMock.mockResolvedValue(new Response("Invalid key", { status: 403 }));
    await expect(createProvider(config).complete("receipt", schema)).rejects.toThrow("Gemini HTTP 403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a temporary service failure", async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response("Unavailable", { status: 503 })).mockResolvedValueOnce(success());
    const result = createProvider(config).complete("receipt", schema);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ amount: 16000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ candidates: [{ finishReason: "MAX_TOKENS" }] }, "Gemini generation stopped: MAX_TOKENS"],
    [{ promptFeedback: { blockReason: "SAFETY" } }, "Gemini returned no text: SAFETY"],
    [{ candidates: [{ content: { parts: [{ text: "not JSON" }] } }] }, "Gemini returned invalid JSON extraction"],
  ])("rejects incomplete or invalid output", async (body, message) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(createProvider(config).complete("receipt", schema)).rejects.toThrow(message);
  });

  it("reports a non-JSON HTTP response", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Error</html>"));
    await expect(createProvider(config).complete("receipt", schema)).rejects.toThrow("Gemini returned a non-JSON response");
  });

  it("applies the request timeout", async () => {
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }));
    await expect(createProvider({ ...config, timeoutMs: 5 }).complete("receipt", schema))
      .rejects.toThrow("AI request timed out after 5ms");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks model availability with native authentication", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await expect(createProvider(config).healthCheck!()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash",
      expect.objectContaining({ headers: { "x-goog-api-key": "test-key" } }),
    );
  });
});
