// In-memory store. Used for local runs and unit tests when no database is configured.
// Each process has its own copy, so this is NOT suitable when running more than one task.

const SEED = [
    { name: "Akash", department: "QA", email: "akash@example.com" },
    { name: "John", department: "Engineering", email: "john@example.com" }
];

function createMemoryStore() {
    const employees = SEED.map((e, i) => ({ id: i + 1, ...e }));
    let nextId = employees.length + 1;

    return {
        name: "memory",

        async init() {},

        async list() {
            return employees;
        },

        async get(id) {
            return employees.find(e => e.id === id) || null;
        },

        async create({ name, department, email }) {
            const employee = { id: nextId++, name, department, email };
            employees.push(employee);
            return employee;
        },

        async update(id, { name, department, email }) {
            const employee = employees.find(e => e.id === id);
            if (!employee) {
                return null;
            }
            Object.assign(employee, { name, department, email });
            return employee;
        },

        async remove(id) {
            const index = employees.findIndex(e => e.id === id);
            if (index === -1) {
                return false;
            }
            employees.splice(index, 1);
            return true;
        },

        async close() {}
    };
}

module.exports = { createMemoryStore, SEED };
