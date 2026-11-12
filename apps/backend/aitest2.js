require("reflect-metadata");
const { AiService } = require("/app/apps/backend/dist/ai/ai.service");

const ai = new AiService({
  get: (key) => ({
    AI_PROVIDER: "9router",
    AI_API_KEY: "sk-dfa8a20352c27954-gcxf7q-8dbbb698",
    AI_BASE_URL: "http://host.docker.internal:20128/v1",
    AI_MODEL: "oc/nemotron-3-ultra-free(high)",
    AI_TIMEOUT_MS: 15000,
  }[key]),
});

async function test() {
  console.log("isAvailable():", ai.isAvailable());
  if (!ai.isAvailable()) {
    console.log("AI not available");
    process.exit(1);
  }

  console.log("healthCheck():", await ai.healthCheck());

  try {
    const result = await ai.extractTransaction("lunch 50k bca");
    console.log("extractTransaction('lunch 50k bca'):", JSON.stringify(result, null, 2));
  } catch (e) {
    console.log("extractTransaction failed:", e.message);
  }
}

test().catch((e) => console.log("FAILED:", e.stack));