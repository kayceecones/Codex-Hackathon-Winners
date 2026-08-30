import "dotenv/config";
import { buildApp } from "./app.js";
import { InMemoryStore } from "./adapters/store/InMemoryStore.js";
import { DbStore } from "./adapters/store/DbStore.js";
import type { Store } from "./adapters/store/Store.js";

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const host = process.env.HOST ?? "0.0.0.0";

if (Number.isNaN(port)) {
  throw new Error("PORT must be a number.");
}

/**
 * DbStore needs DATABASE_URL; Prisma throws on the first query without it,
 * which surfaces as a 500 on every project route rather than a clear boot
 * failure. Pick the store we can actually serve with, and say which.
 */
function selectStore(): Store {
  if (process.env.DATABASE_URL) {
    console.log("[store] DATABASE_URL set - using DbStore (persistent).");
    return new DbStore();
  }
  console.warn(
    "[store] DATABASE_URL not set - falling back to InMemoryStore. " +
      "State is lost on restart. Set DATABASE_URL and run prisma migrate deploy for persistence."
  );
  return new InMemoryStore();
}

const app = await buildApp({ logger: true, store: selectStore() });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
