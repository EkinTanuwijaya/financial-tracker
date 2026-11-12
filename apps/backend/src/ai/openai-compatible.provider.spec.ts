import {
  OpenAiCompatibleProvider,
  createProvider,
} from "./openai-compatible.provider";
import { AiService } from "./ai.service";

describe("AI request handling", () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  const provider = () =>
    new OpenAiCompatibleProvider(
      "test-key",
      "https://provider.example/v1/",
      "model",
      1000,
    );
  it("uses Groq's endpoint and requires an explicit URL for local routers", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [{ function: { arguments: '{"amount":10}' } }],
              },
            },
          ],
        }),
      ),
    );
    await createProvider({
      provider: "groq",
      apiKey: "key",
      model: "model",
    }).complete("input", {});
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.groq.com/openai/v1/chat/completions",
    );
    expect(() =>
      createProvider({ provider: "9router", apiKey: "key", model: "model" }),
    ).toThrow("AI_BASE_URL");
  });
  it("does not retry invalid credentials or successful responses containing invalid JSON", async () => {
    fetchMock.mockResolvedValue(new Response("invalid key", { status: 401 }));
    await expect(provider().complete("input", {})).rejects.toThrow("401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response("not JSON"));
    await expect(provider().complete("input", {})).rejects.toThrow("non-JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps the timeout active while reading the response body", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("body timeout")), 30),
        ),
      text: async () => "",
    }));
    const slow = new OpenAiCompatibleProvider(
      "key",
      "https://provider.example",
      "model",
      10,
      0,
    );
    await expect(slow.complete("input", {})).rejects.toThrow(
      "timed out after 10ms",
    );
  });
  it("rejects malformed AI transaction fields before the bot can use them", async () => {
    const ai = new AiService({ get: () => undefined } as any);
    (ai as any).provider = {
      complete: jest
        .fn()
        .mockResolvedValue({ amount: -5, wallet: "Cash", category: "Food" }),
    };
    await expect(ai.extractTransaction("input")).rejects.toThrow(
      "invalid transaction",
    );
    (ai as any).provider.complete.mockResolvedValue({
      isTransaction: "false",
      confidence: 1,
    });
    await expect(ai.classifyMessage("input")).resolves.toMatchObject({
      isTransaction: false,
      confidence: 0,
    });
  });
});
