import "dotenv/config";
import { buildApp } from "./app.js";
import { DbStore } from "./adapters/store/DbStore.js";

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const host = process.env.HOST ?? "0.0.0.0";

if (Number.isNaN(port)) {
  throw new Error("PORT must be a number.");
}

const app = await buildApp({ logger: true, store: new DbStore() });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
