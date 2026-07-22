// Dev/CI utility: a real Postgres wire-protocol server backed by PGlite (WASM),
// so the EDGEPRESS_STORAGE=postgres adapter can be tested with zero install.
//   node scripts/pg-test-server.mjs   # listens on 127.0.0.1:5433
// Then run EdgePress with:
//   EDGEPRESS_STORAGE=postgres DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: Number(process.env.PG_PORT || 5433), host: "127.0.0.1" });
await server.start();
console.log("PGLITE READY on", process.env.PG_PORT || 5433);
