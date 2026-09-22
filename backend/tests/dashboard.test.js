import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1d";

let mongoReplSet = null;

try {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongoReplSet.getUri();
} catch (_error) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bizflow-test";
}

const { default: app } = await import("../src/server.js");
const User = (await import("../src/models/User.js")).default;
const Customer = (await import("../src/models/Customer.js")).default;
const Product = (await import("../src/models/Product.js")).default;
const Order = (await import("../src/models/Order.js")).default;
const generateToken = (await import("../src/utils/generateToken.js")).default;
const errorMiddleware = (await import("../src/middleware/errorMiddleware.js"))
  .default;

const dbTests = mongoReplSet ? test : test.skip;
let server;
let baseUrl;
let adminToken;
let staffToken;

const createUser = async ({ email, role }) =>
  User.create({
    name: `${role} dashboard user`,
    email,
    password: await bcrypt.hash("password123", 10),
    role,
    status: "active",
  });

const createCustomer = (name = "Dashboard Customer") =>
  Customer.create({
    name,
    email: `${name.toLowerCase().replaceAll(" ", "-")}-${Date.now()}@example.com`,
    phone: "1234567890",
    status: "active",
  });

const createProduct = ({ name, price, stock, status = "active" }) =>
  Product.create({ name, category: "Dashboard", price, stock, status });

const createOrder = ({ customer, items, totalAmount, status, createdAt }) =>
  Order.create({
    customer,
    items,
    totalAmount,
    status,
    ...(createdAt && { createdAt }),
  });

const getDashboard = (token) =>
  fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

test.before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const admin = await createUser({
    email: `dashboard-admin-${Date.now()}@example.com`,
    role: "admin",
  });
  const staff = await createUser({
    email: `dashboard-staff-${Date.now()}@example.com`,
    role: "staff",
  });
  adminToken = generateToken({ userId: admin._id, role: admin.role });
  staffToken = generateToken({ userId: staff._id, role: staff.role });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
});

dbTests("dashboard requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, "Authentication required");
});

dbTests(
  "a signed token without a valid user identity returns 401",
  async () => {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET);
    const response = await getDashboard(token);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid or expired token");
  },
);

dbTests(
  "repeated sort query values are rejected as validation errors",
  async () => {
    const endpoints = [
      "/api/customers?sortOrder=asc&sortOrder=desc",
      "/api/products?sortOrder=asc&sortOrder=desc",
      "/api/orders?sortOrder=asc&sortOrder=desc",
      "/api/users?sortOrder=asc&sortOrder=desc",
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.message, "Validation failed");
      assert.ok(Array.isArray(body.errors));
    }
  },
);

test("unexpected errors use a generic 500 response", () => {
  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  errorMiddleware(new Error("database secret"), {}, response, () => {});

  assert.equal(statusCode, 500);
  assert.deepEqual(responseBody, {
    success: false,
    message: "Something went wrong",
  });
  assert.equal(JSON.stringify(responseBody).includes("database secret"), false);
});

dbTests("admin and staff can access an empty dashboard", async () => {
  await Promise.all([
    Customer.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
  ]);

  for (const token of [adminToken, staffToken]) {
    const response = await getDashboard(token);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data.summary, {
      totalCustomers: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalStaff: 1,
      totalRevenue: 0,
    });
    assert.deepEqual(body.data.orderStatistics, {
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
    });
    assert.deepEqual(body.data.inventoryStatistics, {
      activeProducts: 0,
      inactiveProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
    });
    assert.deepEqual(body.data.customerStatistics, {
      activeCustomers: 0,
      inactiveCustomers: 0,
    });
    assert.deepEqual(body.data.salesOverview, []);
    assert.deepEqual(body.data.recentOrders, []);
    assert.deepEqual(body.data.topProducts, []);
    assert.deepEqual(body.data.lowStockProducts, []);
  }
});

dbTests(
  "dashboard aggregates KPIs, revenue, statuses, and safe fields",
  async () => {
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
    ]);
    const customer = await createCustomer();
    const product = await createProduct({
      name: "Dashboard Laptop",
      price: 100,
      stock: 3,
    });
    const otherProduct = await createProduct({
      name: "Dashboard Mouse",
      price: 20,
      stock: 20,
    });

    await Promise.all([
      createOrder({
        customer: customer._id,
        items: [{ product: product._id, quantity: 2, price: 100 }],
        totalAmount: 200,
        status: "completed",
      }),
      createOrder({
        customer: customer._id,
        items: [{ product: otherProduct._id, quantity: 4, price: 20 }],
        totalAmount: 80,
        status: "pending",
      }),
      createOrder({
        customer: customer._id,
        items: [{ product: product._id, quantity: 5, price: 100 }],
        totalAmount: 500,
        status: "processing",
      }),
      createOrder({
        customer: customer._id,
        items: [{ product: otherProduct._id, quantity: 1, price: 20 }],
        totalAmount: 20,
        status: "cancelled",
      }),
    ]);

    const response = await getDashboard(adminToken);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.summary, {
      totalCustomers: 1,
      totalProducts: 2,
      totalOrders: 4,
      totalStaff: 1,
      totalRevenue: 200,
    });
    assert.deepEqual(body.data.orderStatistics, {
      pending: 1,
      processing: 1,
      completed: 1,
      cancelled: 1,
    });
    assert.deepEqual(body.data.inventoryStatistics, {
      activeProducts: 2,
      inactiveProducts: 0,
      lowStockProducts: 1,
      outOfStockProducts: 0,
    });
    assert.deepEqual(body.data.customerStatistics, {
      activeCustomers: 1,
      inactiveCustomers: 0,
    });
    assert.equal(body.data.salesOverview.length, 1);
    assert.equal(body.data.salesOverview[0].revenue, 200);
    assert.equal(body.data.topProducts[0].name, "Dashboard Laptop");
    assert.equal(body.data.topProducts[0].quantitySold, 2);
    assert.equal(body.data.topProducts[0].revenue, 200);
    assert.equal(body.data.lowStockProducts[0].name, "Dashboard Laptop");
    assert.equal(body.data.lowStockProducts[0].stock, 3);
    assert.equal(body.data.recentOrders[0].customer.email, customer.email);
    assert.equal(JSON.stringify(body).includes("password"), false);
  },
);

dbTests(
  "dashboard returns recent orders newest first and preserves historical top-product data",
  async () => {
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
    ]);
    const customer = await createCustomer("Recent Customer");
    const product = await createProduct({
      name: "Historical Product",
      price: 50,
      stock: 20,
    });
    const newest = new Date("2026-09-10T00:00:00.000Z");
    const oldest = new Date("2026-09-01T00:00:00.000Z");

    await createOrder({
      customer: customer._id,
      items: [{ product: product._id, quantity: 3, price: 40 }],
      totalAmount: 120,
      status: "completed",
      createdAt: oldest,
    });
    await createOrder({
      customer: customer._id,
      items: [{ product: product._id, quantity: 1, price: 40 }],
      totalAmount: 40,
      status: "completed",
      createdAt: newest,
    });
    await Product.deleteOne({ _id: product._id });

    const response = await getDashboard(staffToken);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.recentOrders[0].createdAt, newest.toISOString());
    assert.equal(body.data.recentOrders[0].total, 40);
    assert.equal(body.data.topProducts[0].name, "Unknown Product");
    assert.equal(body.data.topProducts[0].quantitySold, 4);
    assert.equal(body.data.topProducts[0].revenue, 160);
  },
);

dbTests(
  "dashboard counts inactive and out-of-stock records and excludes cancelled revenue",
  async () => {
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
    ]);
    const activeCustomer = await createCustomer("Active Customer");
    await Customer.create({
      name: "Inactive Customer",
      email: `inactive-customer-${Date.now()}@example.com`,
      phone: "1234567890",
      status: "inactive",
    });
    const lowStockProduct = await createProduct({
      name: "Low Stock Product",
      price: 10,
      stock: 2,
    });
    await createProduct({
      name: "Inactive Product",
      price: 20,
      stock: 10,
      status: "inactive",
    });
    await createProduct({
      name: "Out Of Stock Product",
      price: 30,
      stock: 0,
      status: "out_of_stock",
    });

    await createOrder({
      customer: activeCustomer._id,
      items: [{ product: lowStockProduct._id, quantity: 1, price: 10 }],
      totalAmount: 10,
      status: "completed",
    });
    await createOrder({
      customer: activeCustomer._id,
      items: [{ product: lowStockProduct._id, quantity: 1, price: 10 }],
      totalAmount: 999,
      status: "cancelled",
    });

    const response = await getDashboard(adminToken);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.summary.totalRevenue, 10);
    assert.deepEqual(body.data.customerStatistics, {
      activeCustomers: 1,
      inactiveCustomers: 1,
    });
    assert.deepEqual(body.data.inventoryStatistics, {
      activeProducts: 1,
      inactiveProducts: 1,
      lowStockProducts: 1,
      outOfStockProducts: 1,
    });
    assert.equal(body.data.lowStockProducts.length, 1);
    assert.equal(body.data.lowStockProducts[0].name, "Low Stock Product");
  },
);
