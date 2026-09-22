import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1d";

let mongoServer = null;

try {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
} catch (error) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bizflow-test";
}

const { default: app } = await import("../src/server.js");
const User = (await import("../src/models/User.js")).default;
const Customer = (await import("../src/models/Customer.js")).default;
const generateToken = (await import("../src/utils/generateToken.js")).default;

const dbTests = mongoServer ? test : test.skip;
let baseUrl;
let server;

let adminToken;
let staffToken;

const createUser = async ({
  name = "Test User",
  email,
  password = "password123",
  role = "staff",
  status = "active",
} = {}) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    status,
  });
};

test.before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const admin = await createUser({
    name: "Admin User",
    email: `admin-${Date.now()}@example.com`,
    role: "admin",
  });
  adminToken = generateToken({ userId: admin._id, role: admin.role });

  const staff = await createUser({
    name: "Staff User",
    email: `staff-${Date.now()}@example.com`,
    role: "staff",
  });
  staffToken = generateToken({ userId: staff._id, role: staff.role });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Authentication tests
dbTests("1. unauthenticated GET customers returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/customers`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

dbTests("2. unauthenticated POST customer returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Acme Corp",
      email: "contact@acme.com",
      phone: "1234567890",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

// GET listing tests
dbTests("3. authenticated admin can list customers", async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.customers));
  assert.ok(body.data.pagination);
  assert.equal(typeof body.data.pagination.page, "number");
  assert.equal(typeof body.data.pagination.total, "number");
});

dbTests("4. authenticated staff can list customers", async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.customers));
});

dbTests("5. search works across name, email, phone, and company", async () => {
  await Customer.deleteMany({});

  await Customer.create([
    {
      name: "Johnathan Smith",
      email: "jsmith@example.com",
      phone: "1112223333",
      company: "Alpha Tech",
      status: "active",
    },
    {
      name: "Alice Wonderland",
      email: "alice@wonder.com",
      phone: "4445556666",
      company: "Bravo Solutions",
      status: "active",
    },
    {
      name: "Robert Johnson",
      email: "robert@beta.com",
      phone: "7778889999",
      company: "Charlie Industries",
      status: "inactive",
    },
  ]);

  // Search by name
  const nameRes = await fetch(`${baseUrl}/api/customers?search=john`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const nameBody = await nameRes.json();
  assert.equal(nameRes.status, 200);
  assert.equal(nameBody.data.customers.length, 2); // Johnathan Smith and Robert Johnson

  // Search by company
  const compRes = await fetch(`${baseUrl}/api/customers?search=solutions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const compBody = await compRes.json();
  assert.equal(compRes.status, 200);
  assert.equal(compBody.data.customers.length, 1);
  assert.equal(compBody.data.customers[0].name, "Alice Wonderland");

  // Search by phone
  const phoneRes = await fetch(`${baseUrl}/api/customers?search=111222`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const phoneBody = await phoneRes.json();
  assert.equal(phoneRes.status, 200);
  assert.equal(phoneBody.data.customers.length, 1);
  assert.equal(phoneBody.data.customers[0].name, "Johnathan Smith");
});

dbTests("6. status filter works for active and inactive", async () => {
  const activeRes = await fetch(`${baseUrl}/api/customers?status=active`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const activeBody = await activeRes.json();
  assert.equal(activeRes.status, 200);
  assert.equal(
    activeBody.data.customers.every((c) => c.status === "active"),
    true,
  );

  const inactiveRes = await fetch(`${baseUrl}/api/customers?status=inactive`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const inactiveBody = await inactiveRes.json();
  assert.equal(inactiveRes.status, 200);
  assert.equal(
    inactiveBody.data.customers.every((c) => c.status === "inactive"),
    true,
  );
  assert.ok(inactiveBody.data.customers.length >= 1);
});

dbTests("7. pagination works with page and limit", async () => {
  const res = await fetch(`${baseUrl}/api/customers?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.data.customers.length, 2);
  assert.equal(body.data.pagination.page, 1);
  assert.equal(body.data.pagination.limit, 2);
  assert.equal(body.data.pagination.total, 3);
  assert.equal(body.data.pagination.totalPages, 2);

  const page2Res = await fetch(`${baseUrl}/api/customers?page=2&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const page2Body = await page2Res.json();
  assert.equal(page2Res.status, 200);
  assert.equal(page2Body.data.customers.length, 1);
  assert.equal(page2Body.data.pagination.page, 2);
});

dbTests("8. sorting works by whitelist field and direction", async () => {
  const ascRes = await fetch(
    `${baseUrl}/api/customers?sortBy=name&sortOrder=asc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const ascBody = await ascRes.json();
  assert.equal(ascRes.status, 200);
  assert.equal(ascBody.data.customers[0].name, "Alice Wonderland");

  const descRes = await fetch(
    `${baseUrl}/api/customers?sortBy=name&sortOrder=desc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const descBody = await descRes.json();
  assert.equal(descRes.status, 200);
  assert.equal(descBody.data.customers[0].name, "Robert Johnson");
});

dbTests("invalid query parameters return 400 Bad Request", async () => {
  // Invalid page
  const pageRes = await fetch(`${baseUrl}/api/customers?page=0`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(pageRes.status, 400);

  // Invalid limit (> 100)
  const limitRes = await fetch(`${baseUrl}/api/customers?limit=105`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(limitRes.status, 400);

  // Invalid status
  const statusRes = await fetch(`${baseUrl}/api/customers?status=deleted`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(statusRes.status, 400);

  // Invalid sortBy field (not in whitelist)
  const sortRes = await fetch(`${baseUrl}/api/customers?sortBy=password`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(sortRes.status, 400);

  // Invalid sortOrder
  const orderRes = await fetch(`${baseUrl}/api/customers?sortOrder=random`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(orderRes.status, 400);
});

// GET by ID tests
dbTests("9. get customer by ID works", async () => {
  const created = await Customer.create({
    name: "Target Customer",
    email: `target-${Date.now()}@example.com`,
    phone: "1231231234",
  });

  const response = await fetch(`${baseUrl}/api/customers/${created._id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.customer._id, created._id.toString());
  assert.equal(body.data.customer.name, "Target Customer");
});

dbTests("10. invalid ID returns 400", async () => {
  const response = await fetch(`${baseUrl}/api/customers/not-a-valid-id`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors);
});

dbTests("11. non-existing ID returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/customers/${fakeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Customer not found");
});

// POST customer tests
dbTests("12. admin can create customer", async () => {
  const customerData = {
    name: "Admin Created Co",
    email: `admin-created-${Date.now()}@example.com`,
    phone: "555-123-4567",
    company: "Big Enterprise",
    address: "100 Main St, Cityville",
    status: "active",
  };

  const response = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(customerData),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.message, "Customer created successfully");
  assert.equal(body.data.customer.name, customerData.name);
  assert.equal(body.data.customer.email, customerData.email);
  assert.equal(body.data.customer.company, customerData.company);
  assert.equal(body.data.customer.status, "active");
});

dbTests("13. staff can create customer with default status", async () => {
  const customerData = {
    name: "Staff Created Client",
    email: `staff-created-${Date.now()}@example.com`,
    phone: "555-987-6543",
  };

  const response = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(customerData),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.customer.status, "active"); // Defaults to active
});

dbTests("14. invalid required fields are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "A", // too short (< 2)
      email: "valid@email.com",
      // phone missing
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors));
});

dbTests("15. invalid email is rejected", async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Valid Name",
      email: "invalid-email-format",
      phone: "1234567890",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors.some((e) => e.field === "email"));
});

dbTests("16. duplicate email returns 409", async () => {
  const email = `unique-${Date.now()}@example.com`;

  await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "First Customer",
      email,
      phone: "1111111111",
    }),
  });

  const duplicateResponse = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Second Customer",
      email,
      phone: "2222222222",
    }),
  });
  const body = await duplicateResponse.json();

  assert.equal(duplicateResponse.status, 409);
  assert.equal(body.success, false);
  assert.match(body.message, /Email already registered|Customer with this email already exists/i);
});

// PUT customer tests
dbTests("17. admin can update customer", async () => {
  const customer = await Customer.create({
    name: "Before Update Admin",
    email: `before-admin-${Date.now()}@example.com`,
    phone: "1234567890",
  });

  const response = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "After Update Admin",
      phone: "9999999999",
      status: "inactive",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Customer updated successfully");
  assert.equal(body.data.customer.name, "After Update Admin");
  assert.equal(body.data.customer.phone, "9999999999");
  assert.equal(body.data.customer.status, "inactive");
});

dbTests("18. staff can update customer", async () => {
  const customer = await Customer.create({
    name: "Before Update Staff",
    email: `before-staff-${Date.now()}@example.com`,
    phone: "1234567890",
  });

  const response = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      company: "Updated Staff Company",
      address: "456 Side Ave",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.customer.company, "Updated Staff Company");
  assert.equal(body.data.customer.address, "456 Side Ave");
});

dbTests("19. invalid update is rejected", async () => {
  const customer = await Customer.create({
    name: "Valid Customer",
    email: `update-invalid-${Date.now()}@example.com`,
    phone: "1234567890",
  });

  // Empty update body
  const emptyRes = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(emptyRes.status, 400);

  // Invalid email format
  const badEmailRes = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  assert.equal(badEmailRes.status, 400);

  // Invalid status value
  const badStatusRes = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "archived" }),
  });
  assert.equal(badStatusRes.status, 400);
});

dbTests("20. duplicate email update returns 409", async () => {
  const emailA = `email-a-${Date.now()}@example.com`;
  const emailB = `email-b-${Date.now()}@example.com`;

  await Customer.create({
    name: "Customer A",
    email: emailA,
    phone: "1111111111",
  });

  const customerB = await Customer.create({
    name: "Customer B",
    email: emailB,
    phone: "2222222222",
  });

  // Try to update customer B to customer A's email
  const response = await fetch(`${baseUrl}/api/customers/${customerB._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email: emailA }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, false);
});

dbTests("updating customer with same email succeeds", async () => {
  const email = `self-email-${Date.now()}@example.com`;
  const customer = await Customer.create({
    name: "Self Email Customer",
    email,
    phone: "1111111111",
  });

  const response = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email, name: "Self Email Updated" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.customer.name, "Self Email Updated");
});

dbTests("21. non-existing customer update returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/customers/${fakeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: "Updated Name" }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Customer not found");
});

// DELETE customer tests
dbTests("22. admin can delete customer", async () => {
  const customer = await Customer.create({
    name: "To Be Deleted By Admin",
    email: `delete-admin-${Date.now()}@example.com`,
    phone: "1234567890",
  });

  const response = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Customer deleted successfully");

  const check = await Customer.findById(customer._id);
  assert.equal(check, null);
});

dbTests("23. staff can delete customer", async () => {
  const customer = await Customer.create({
    name: "To Be Deleted By Staff",
    email: `delete-staff-${Date.now()}@example.com`,
    phone: "1234567890",
  });

  const response = await fetch(`${baseUrl}/api/customers/${customer._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Customer deleted successfully");

  const check = await Customer.findById(customer._id);
  assert.equal(check, null);
});

dbTests("24. non-existing customer delete returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/customers/${fakeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Customer not found");
});
