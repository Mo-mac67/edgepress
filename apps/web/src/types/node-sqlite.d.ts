// Minimal ambient types for Node's built-in `node:sqlite` (experimental in
// Node 22.5+), which @types/node doesn't ship yet. Only the surface EdgePress's
// sqlite adapter uses (see lib/sqlite-kv.ts).
declare module "node:sqlite" {
  export class StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(location: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
