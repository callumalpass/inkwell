import { resolve } from "node:path";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",
  dataDir: resolve(process.env.DATA_DIR || "./data"),
};
