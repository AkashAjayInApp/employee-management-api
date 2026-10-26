const express = require("express");

const REQUIRED_FIELDS = ["name", "department", "email"];

function validateEmployee(body) {
    const missing = REQUIRED_FIELDS.filter(
        field => typeof body?.[field] !== "string" || body[field].trim() === ""
    );
    return missing.length ? `Missing or empty fields: ${missing.join(", ")}` : null;
}

// Returns a positive integer id, or null for anything else ("abc", "-1", "1.5").
function parseId(value) {
    return /^[1-9]\d*$/.test(value) ? parseInt(value) : null;
}

function createApp(store) {
    const app = express();

    app.use(express.json());

    app.get("/", (req, res) => {
        res.json({
            status: "UP",
            message: "Employee API is running"
        });
    });

    // Liveness only: does not touch the database. If it did, a short database
    // outage would fail every task's health check and ECS would replace all of them.
    app.get("/health", (req, res) => {
        res.status(200).json({
            status: "UP"
        });
    });

    app.get("/employees", async (req, res) => {
        res.json(await store.list());
    });

    app.get("/employees/:id", async (req, res) => {
        const id = parseId(req.params.id);
        const employee = id && await store.get(id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        res.json(employee);
    });

    app.post("/employees", async (req, res) => {
        const error = validateEmployee(req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }

        const employee = await store.create(req.body);

        res.status(201).json(employee);
    });

    app.put("/employees/:id", async (req, res) => {
        const id = parseId(req.params.id);
        if (!id || !await store.get(id)) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        const error = validateEmployee(req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }

        res.json(await store.update(id, req.body));
    });

    app.delete("/employees/:id", async (req, res) => {
        const id = parseId(req.params.id);
        if (!id || !await store.remove(id)) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        res.status(204).send();
    });

    // Express 5 forwards errors from async handlers here (e.g. database unreachable).
    app.use((err, req, res, next) => {
        // Client errors raised by Express itself, e.g. malformed JSON body (400)
        // or payload too large (413), are the caller's fault, not a server error.
        if (err.status >= 400 && err.status < 500) {
            return res.status(err.status).json({ message: "Invalid request body" });
        }
        console.error(`${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ message: "Internal server error" });
    });

    return app;
}

module.exports = { createApp };
