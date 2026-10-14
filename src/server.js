const { createApp } = require("./app");
const { createMemoryStore } = require("./store/memory");
const { createPostgresStore } = require("./store/postgres");

const PORT = process.env.PORT || 8080;

// Use PostgreSQL when a database is configured; otherwise fall back to memory
// so `docker run` works locally without a database.
const store = process.env.DB_HOST ? createPostgresStore() : createMemoryStore();

async function start() {
    await store.init();
    console.log(`Using ${store.name} store`);

    const server = createApp(store).listen(PORT, "0.0.0.0", () => {
        console.log(`Employee API running on port ${PORT}`);
    });

    // ECS sends SIGTERM before stopping a task (rolling deploys, scale-in, task stop).
    // Finish in-flight requests instead of dropping them, then close DB connections.
    process.on("SIGTERM", () => {
        console.log("SIGTERM received, closing server");
        server.close(async () => {
            await store.close();
            process.exit(0);
        });
    });
}

start().catch(err => {
    console.error("Failed to start:", err.message);
    process.exit(1);
});
