// A small payments service. The `customers` table lives in Postgres
// (see schema/001_init.sql). The migration demo adds a `status` column;
// this repository grows a method that DEPENDS on it — so the feature
// cannot land until the governed migration does.
import { Pool } from "pg";

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  status: string; // present only after the db-migration lands
  created_at: Date;
}

const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "postgres",
  database: process.env.PGDATABASE ?? "payments",
});

export class CustomerRepo {
  async list(): Promise<Customer[]> {
    const { rows } = await pool.query(
      "SELECT id, name, email, status, created_at FROM customers ORDER BY id",
    );
    return rows;
  }

  async findById(id: number): Promise<Customer | null> {
    const { rows } = await pool.query(
      "SELECT id, name, email, status, created_at FROM customers WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }
}
