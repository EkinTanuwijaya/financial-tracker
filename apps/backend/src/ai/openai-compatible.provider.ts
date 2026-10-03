import { AiProvider, AiConfig } from "./ai.interface";

function schemaToFunction(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    name: "extract",
    description: "Extract structured data from user input",
    parameters: schema,
  };
}

function tryParseJsonFromText(text: string): any | null {
  try {
    // Try to find JSON object in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs = 60_000,
    private readonly maxRetries = 2,
  ) {}

  async complete<T>(
    prompt: string,
    schema: Record<string, unknown>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "You are a precise data extraction engine. Output only valid JSON matching the provided schema. No explanations, no markdown, no extra text.",
              },
              { role: "user", content: prompt },
            ],
            tools: [{ type: "function", function: schemaToFunction(schema) }],
            tool_choice: { type: "function", function: { name: "extract" } },
            temperature: 0,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          let text = "";
          try {
            text = await response.text();
          } catch {
            try {
              text = JSON.stringify(await response.json());
            } catch {
              text = `HTTP ${response.status}`;
            }
          }
          throw new Error(
            `AI provider HTTP ${response.status}: ${text.slice(0, 200)}`,
          );
        }

        let data: any;
        try {
          data = await response.json();
        } catch {
          const text = await response.text().catch(() => "");
          throw new Error(`AI provider returned non-JSON: ${text.slice(0, 200)}`);
        }

        const call =
          data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (call) {
          return JSON.parse(call) as T;
        }

        // Fallback: try to parse JSON from response text
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = tryParseJsonFromText(content);
          if (parsed) {
            return parsed as T;
          }
        }

        throw new Error("No function call or valid JSON returned by the model");
      } catch (err) {
        clearTimeout(timeout);
        lastError = err as Error;

        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error(`AI request timed out after ${this.timeoutMs}ms`);
        }

        // Retry on network errors
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function createProvider(config: AiConfig): AiProvider {
  switch (config.provider) {
    case "openai":
    case "9router":
    case "groq":
      return new OpenAiCompatibleProvider(
        config.apiKey,
        config.baseUrl ?? "https://api.openai.com/v1",
        config.model,
        config.timeoutMs,
        2, // maxRetries
      );
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}
