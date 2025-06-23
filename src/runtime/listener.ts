import { Pool } from "pg";
import EventEmitter from "events";
import dotenv from "dotenv";

dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || "10", 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(
    process.env.PG_CONNECTION_TIMEOUT || "2000",
    10
  ),
});

const dbEvents = new EventEmitter();
const activeTables = new Set<string>();

/**
 * Internally registers a LISTEN channel for a table, only once
 */
export async function startDbListener(table: string) {
  if (activeTables.has(table)) return;
  activeTables.add(table);

  const channel = `table_insert_${table}`;
  const client = await pool.connect();

  await client.query(`LISTEN "${channel}"`);

  client.on("notification", (msg) => {
    if (msg.channel === channel) {
      try {
        const payload = JSON.parse(msg.payload ?? "{}");
        dbEvents.emit(channel, payload);
      } catch (err) {
        console.error("Invalid JSON from NOTIFY:", msg.payload);
      }
    }
  });

  client.on("error", (err) => {
    console.error("PostgreSQL listener error:", err);
  });
}

/**
 * Public method to subscribe to insert events on a table
 */
export async function onInsert(table: string, callback: (row: any) => void) {
  await startDbListener(table);
  const channel = `table_insert_${table}`;
  dbEvents.on(channel, callback);
}
