import { AiConfig, AiProvider } from "./ai.interface";

type GeminiResponse = {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  promptFeedback?: { blockReason?: string };
};

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly modelUrl: string;

  constructor(private readonly config: AiConfig) {
    const baseUrl = (config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    this.modelUrl = `${baseUrl}/models/${encodeURIComponent(config.model.replace(/^models\//, ""))}`;
  }

  async complete<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
    const timeoutMs = Number(this.config.timeoutMs ?? 60_000);
    for (let attempt = 0; attempt <= 2; attempt++) {
      const signal = AbortSignal.timeout(timeoutMs);
      let status: number | undefined;
      try {
        const response = await fetch(`${this.modelUrl}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Extract structured data. Return only JSON matching the supplied schema." }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              ...(this.config.model.replace(/^models\//, "") === "gemini-3.8-flash"
                ? { thinkingConfig: { thinkingLevel: "low" } }
                : { temperature: 0 }),
              responseMimeType: "application/json",
              responseJsonSchema: schema,
            },
          }),
          signal,
        });
        status = response.status;
        if (!response.ok) {
          throw new Error(`Gemini HTTP ${status}: ${(await response.text()).slice(0, 200)}`);
        }
        let data: GeminiResponse;
        try {
          data = await response.json() as GeminiResponse;
        } catch (error) {
          if (signal.aborted) throw error;
          throw new Error("Gemini returned a non-JSON response");
        }
        const candidate = data?.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          throw new Error(`Gemini generation stopped: ${candidate.finishReason}`);
        }
        const text = candidate?.content?.parts
          ?.filter((part) => !part.thought && typeof part.text === "string")
          .map((part) => part.text).join("");
        if (!text) {
          throw new Error(`Gemini returned no text${data?.promptFeedback?.blockReason ? `: ${data.promptFeedback.blockReason}` : ""}`);
        }
        try {
          const result = JSON.parse(text);
          if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
          return result as T;
        } catch {
          throw new Error("Gemini returned invalid JSON extraction");
        }
      } catch (error) {
        if (signal.aborted) throw new Error(`AI request timed out after ${timeoutMs}ms`);
        if (attempt === 2 || (status !== undefined && status !== 429 && status < 500)) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
    throw new Error("Gemini retries exhausted");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.modelUrl, {
        headers: { "x-goog-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
