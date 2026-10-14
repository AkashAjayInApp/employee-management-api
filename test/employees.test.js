const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { createMemoryStore } = require("../src/store/memory");

const app = createApp(createMemoryStore());

let server;
let baseUrl;

before(() => new Promise(resolve => {
    server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
    });
}));

after(() => new Promise(resolve => server.close(resolve)));

function request(method, path, body) {
    return fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
    });
}

const newEmployee = { name: "Priya", department: "DevOps", email: "priya@example.com" };

test("GET /health returns UP", async () => {
    const res = await request("GET", "/health");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "UP" });
});

test("GET /employees returns a list", async () => {
    const res = await request("GET", "/employees");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(await res.json()));
});

test("GET /employees/:id returns 404 for unknown id", async () => {
    const res = await request("GET", "/employees/9999");
    assert.equal(res.status, 404);
});

test("POST /employees creates an employee", async () => {
    const res = await request("POST", "/employees", newEmployee);
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, newEmployee.name);

    const fetched = await request("GET", `/employees/${created.id}`);
    assert.equal(fetched.status, 200);
});

test("POST /employees rejects missing fields", async () => {
    const res = await request("POST", "/employees", { name: "No Email" });
    assert.equal(res.status, 400);
});

test("ids are not reused after a delete", async () => {
    const first = await (await request("POST", "/employees", newEmployee)).json();
    assert.equal((await request("DELETE", `/employees/${first.id}`)).status, 204);

    const second = await (await request("POST", "/employees", newEmployee)).json();
    assert.notEqual(second.id, first.id);
});

test("PUT /employees/:id updates an employee", async () => {
    const res = await request("PUT", "/employees/1", { ...newEmployee, name: "Akash A" });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).name, "Akash A");
});

test("GET /employees/:id returns 404 for a non-numeric id", async () => {
    const res = await request("GET", "/employees/abc");
    assert.equal(res.status, 404);
});

test("DELETE /employees/:id returns 404 for unknown id", async () => {
    const res = await request("DELETE", "/employees/9999");
    assert.equal(res.status, 404);
});
