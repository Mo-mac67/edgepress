// Minimal ambient types for the optional `pg` peer dependency (see
// lib/postgres-kv.ts). Declared here so the build typechecks without `pg`
// installed; self-hosters using Postgres run `npm install pg`.
declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string });
    query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>> }>;
  }
}
