import { pool } from "@/lib/db";

/**
 * Menjalankan kueri SQL dengan jaminan READ ONLY di tingkat PostgreSQL transaction.
 */
export async function executeReadOnlyQuery<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query(text, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw error;
  } finally {
    client.release();
  }
}
