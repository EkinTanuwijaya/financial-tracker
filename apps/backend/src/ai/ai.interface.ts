export interface AiProvider {
  readonly name: string;
  /**
   * Sends a prompt and expects a JSON response matching the given schema.
   * The provider is responsible for enforcing the schema (via function calling,
   * JSON mode, or prompt engineering). Implementations should throw on
   * parse/validation failure rather than returning garbage.
   */
  complete<T>(prompt: string, schema: Record<string, unknown>): Promise<T>;

  /** Optional: lightweight health check. */
  healthCheck?(): Promise<boolean>;
}

export interface AiProviderFactory {
  create(config: AiConfig): AiProvider;
}

export interface AiConfig {
  provider: "openai" | "gemini" | "9router" | string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
}
