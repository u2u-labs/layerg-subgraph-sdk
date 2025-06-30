import type { QueryResultRow } from "pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.PG_POOL_MAX || "10"),
  idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: Number.parseInt(
    process.env.PG_CONNECTION_TIMEOUT || "2000"
  ),
});

function assertRows<T>(result: unknown): asserts result is T[] {
  if (!Array.isArray(result)) {
    throw new Error("Expected query result to be an array");
  }
}

const columnCache: Record<string, string[]> = {};

async function getTableColumns(table: string): Promise<string[]> {
  if (columnCache[table]) return columnCache[table];
  const { rows } = await pool.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
    [table]
  );
  const columns = rows.map((row) => row.column_name);
  columnCache[table] = columns;
  return columns;
}

export async function set(
  table: string,
  data: Record<string, unknown>
): Promise<void> {
  const columns = await getTableColumns(table);
  const keys = Object.keys(data).filter((k) => columns.includes(k));
  const values = keys.map((k) => data[k]);
  const columnStr = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const updates = keys
    .filter((k) => k !== "id")
    .map((k) => `"${k}" = EXCLUDED."${k}"`)
    .join(", ");

  const query = `
    INSERT INTO "${table}" (${columnStr}) VALUES (${placeholders})
    ON CONFLICT ("id") DO UPDATE SET ${updates};
  `;

  await pool.query(query, values);
}

export async function get<T extends QueryResultRow>(
  table: string,
  id: string
): Promise<T | null> {
  const { rows } = await pool.query<T>(
    `SELECT * FROM "${table}" WHERE id = $1 LIMIT 1`,
    [id]
  );
  assertRows<T>(rows);
  return rows[0] ?? null;
}

export async function getBy<T extends QueryResultRow>(
  table: string,
  field: string,
  value: unknown
): Promise<T | null> {
  const { rows } = await pool.query<T>(
    `SELECT * FROM "${table}" WHERE "${field}" = $1 LIMIT 1`,
    [value]
  );
  assertRows<T>(rows);
  return rows[0] ?? null;
}

export async function count<T extends QueryResultRow>(
  table: string,
  where: Partial<Record<keyof T, unknown>> = {}
): Promise<number> {
  const keys = Object.keys(where);
  let query = `SELECT COUNT(*) FROM "${table}"`;
  let values: unknown[] = [];

  if (keys.length > 0) {
    const conditions = keys.map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
    query += ` WHERE ${conditions}`;
    values = keys.map((k) => where[k as keyof T]);
  }

  const { rows } = await pool.query<{ count: string }>(query, values);
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}
