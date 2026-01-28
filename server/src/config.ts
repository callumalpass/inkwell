import { resolve } from "node:path";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",
  dataDir: resolve(process.env.DATA_DIR || "./data"),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: "gemini-3-flash-preview",
  },
  transcription: {
    autoTranscribe: process.env.AUTO_TRANSCRIBE !== "false",
    idleDelayMs: parseInt(process.env.TRANSCRIBE_DELAY_MS || "30000", 10),
    maxRetries: 3,
    pollIntervalMs: 5000,
  },
};
