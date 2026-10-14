const fs = require("fs");
const { Pool } = require("pg");
const { SEED } = require("./memory");

// Connection settings come from environment variables. In ECS, DB_USER and
// DB_PASSWORD are injected from AWS Secrets Manager by the task definition,
// so no credentials live in code, the image, or the repository.
function buildConfig(env) {
    const config = {
        host: env.DB_HOST,
        port: parseInt(env.DB_PORT || "5432"),
        database: env.DB_NAME || "postgres",
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        max: parseInt(env.DB_POOL_SIZE || "10"),
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
    };

    // RDS/Aurora require TLS. Verify the server certificate against the
    // AWS RDS CA bundle baked into the image. DB_SSL=false is for local Postgres only.
    if (env.DB_SSL !== "false") {
        config.ssl = {
            rejectUnauthorized: true,
            ca: fs.readFileSync(env.DB_SSL_CA || "/app/rds-global-bundle.pem", "utf8")
        };
    }

    return config;
}

function createPostgresStore(env = process.env) {
    const pool = new Pool(buildConfig(env));

    // Idle connections can be dropped by the server (failover, restart, network blip).
    // Without this handler the error is unhandled and crashes the whole process.
    // The pool discards the broken connection and opens a new one on the next query.
    pool.on("error", err => {
        console.error("Idle database connection error:", err.message);
    });

    return {
        name: "postgres",

        // Create the table on startup and seed it once, so a fresh database works.
        async init() {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS employees (
                    id         SERIAL PRIMARY KEY,
                    name       TEXT NOT NULL,
                    department TEXT NOT NULL,
                    email      TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            `);

            const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM employees");
            if (rows[0].count === 0) {
                for (const e of SEED) {
                    await pool.query(
                        "INSERT INTO employees (name, department, email) VALUES ($1, $2, $3)",
                        [e.name, e.department, e.email]
                    );
                }
            }
        },

        async list() {
            const { rows } = await pool.query(
                "SELECT id, name, department, email FROM employees ORDER BY id"
            );
            return rows;
        },

        async get(id) {
            const { rows } = await pool.query(
                "SELECT id, name, department, email FROM employees WHERE id = $1",
                [id]
            );
            return rows[0] || null;
        },

        async create({ name, department, email }) {
            const { rows } = await pool.query(
                `INSERT INTO employees (name, department, email) VALUES ($1, $2, $3)
                 RETURNING id, name, department, email`,
                [name, department, email]
            );
            return rows[0];
        },

        async update(id, { name, department, email }) {
            const { rows } = await pool.query(
                `UPDATE employees SET name = $2, department = $3, email = $4 WHERE id = $1
                 RETURNING id, name, department, email`,
                [id, name, department, email]
            );
            return rows[0] || null;
        },

        async remove(id) {
            const { rowCount } = await pool.query("DELETE FROM employees WHERE id = $1", [id]);
            return rowCount > 0;
        },

        async close() {
            await pool.end();
        }
    };
}

module.exports = { createPostgresStore };
