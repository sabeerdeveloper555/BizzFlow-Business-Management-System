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
const authorizeRoles = (await import("../src/middleware/roleMiddleware.js"))
  .default;
const generateToken = (await import("../src/utils/generateToken.js")).default;

const dbTests = mongoServer ? test : test.skip;
const port = 4123;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

const createUser = async ({
  name = "Test User",
  email,
  password = "password123",
  role = "staff",
  status = "active",
} = {}) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    status,
  });

  return user;
};

test.before(async () => {
  server = app.listen(port);
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

test("GET /api/health still works", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
});

dbTests(
  "register creates a safe staff user and hashes the password",
  async () => {
    const email = `register-${Date.now()}@example.com`;
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email,
        password: "password123",
      }),
    });

    const body = await response.json();
    const userRecord = await User.findOne({ email }).select("+password");

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.user.role, "staff");
    assert.equal(body.user.status, "active");
    assert.equal(body.user.email, email);
    assert.equal(body.user.name, "John Doe");
    assert.ok(!Object.prototype.hasOwnProperty.call(body.user, "password"));
    assert.ok(userRecord.password.startsWith("$2"));
    assert.notEqual(userRecord.password, "password123");
  },
);

dbTests(
  "registration ignores a client-supplied admin role and defaults to staff",
  async () => {
    const email = `admin-ignored-${Date.now()}@example.com`;
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Jane Doe",
        email,
        password: "password123",
        role: "admin",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.user.role, "staff");
    assert.equal(body.user.status, "active");
  },
);

dbTests("duplicate email is rejected", async () => {
  const email = `duplicate-${Date.now()}@example.com`;

  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Initial User",
      email,
      password: "password123",
    }),
  });

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate User",
      email,
      password: "password123",
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.message, "Email already registered");
});

dbTests("invalid registration data is rejected", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "J", email: "bad-email", password: "123" }),
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors));
});

dbTests("login returns a JWT for valid credentials", async () => {
  const email = `login-${Date.now()}@example.com`;
  const password = "password123";
  await createUser({ email, password });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.token);
  assert.equal(body.user.email, email);
  assert.equal(body.user.role, "staff");
});

dbTests("wrong password and unknown email both return 401", async () => {
  const validEmail = `credentials-${Date.now()}@example.com`;
  await createUser({ email: validEmail, password: "password123" });

  const wrongPasswordResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: validEmail, password: "wrongpass" }),
  });
  const wrongPasswordBody = await wrongPasswordResponse.json();

  const unknownEmailResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `missing-${Date.now()}@example.com`,
      password: "password123",
    }),
  });
  const unknownEmailBody = await unknownEmailResponse.json();

  assert.equal(wrongPasswordResponse.status, 401);
  assert.equal(wrongPasswordBody.message, "Invalid email or password");
  assert.equal(unknownEmailResponse.status, 401);
  assert.equal(unknownEmailBody.message, "Invalid email or password");
});

dbTests("inactive users cannot log in", async () => {
  const email = `inactive-${Date.now()}@example.com`;
  await createUser({ email, password: "password123", status: "inactive" });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.message, "Account is inactive");
});

dbTests(
  "GET /api/auth/me validates JWT and loads the current user",
  async () => {
    const email = `me-${Date.now()}@example.com`;
    const user = await createUser({ email, password: "password123" });
    const token = generateToken({ userId: user._id, role: user.role });

    const validResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const validBody = await validResponse.json();

    const missingTokenResponse = await fetch(`${baseUrl}/api/auth/me`);
    const missingTokenBody = await missingTokenResponse.json();

    const invalidTokenResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    const invalidTokenBody = await invalidTokenResponse.json();

    assert.equal(validResponse.status, 200);
    assert.equal(validBody.user.email, email);
    assert.equal(validBody.user.role, "staff");
    assert.equal(missingTokenResponse.status, 401);
    assert.equal(missingTokenBody.message, "Authentication required");
    assert.equal(invalidTokenResponse.status, 401);
    assert.equal(invalidTokenBody.message, "Invalid or expired token");
  },
);

dbTests("deleted user cannot use a JWT", async () => {
  const email = `deleted-${Date.now()}@example.com`;
  const user = await createUser({ email, password: "password123" });
  const token = generateToken({ userId: user._id, role: user.role });

  await User.findByIdAndDelete(user._id);

  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, "User not found");
});

dbTests(
  "role authorization middleware accepts admin and rejects staff",
  async () => {
    const adminRequest = { user: { role: "admin" } };
    const staffRequest = { user: { role: "staff" } };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    const adminResponse = {
      status: () => ({ json: () => ({}) }),
    };
    const staffResponse = {
      status: () => ({ json: () => ({}) }),
    };

    assert.doesNotThrow(() =>
      authorizeRoles("admin")(adminRequest, adminResponse, next),
    );
    assert.equal(nextCalled, true);

    nextCalled = false;
    const result = authorizeRoles("admin")(staffRequest, staffResponse, next);

    assert.equal(result && result.statusCode, undefined);
    assert.equal(nextCalled, false);
  },
);

dbTests(
  "logout endpoint returns a successful response without claiming server-side invalidation",
  async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /Logged out successfully/i);
  },
);
