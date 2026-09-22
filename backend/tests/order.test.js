import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
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
} catch (error) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bizflow-test";
}

const { default: app } = await import("../src/server.js");
const User = (await import("../src/models/User.js")).default;
const Customer = (await import("../src/models/Customer.js")).default;
const Product = (await import("../src/models/Product.js")).default;
const Order = (await import("../src/models/Order.js")).default;
const generateToken = (await import("../src/utils/generateToken.js")).default;

const dbTests = mongoReplSet ? test : test.skip;
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

const createCustomerHelper = async ({
  name = "Order Customer",
  email,
  phone = "1234567890",
  status = "active",
} = {}) => {
  return await Customer.create({
    name,
    email: email || `cust-${Date.now()}-${Math.random()}@example.com`,
    phone,
    status,
  });
};

const createProductHelper = async ({
  name = "Order Product",
  category = "Goods",
  price = 100,
  stock = 10,
  status = "active",
} = {}) => {
  return await Product.create({
    name,
    category,
    price,
    stock,
    status,
  });
};

test.before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const admin = await createUser({
    name: "Order Admin",
    email: `order-admin-${Date.now()}@example.com`,
    role: "admin",
  });
  adminToken = generateToken({ userId: admin._id, role: admin.role });

  const staff = await createUser({
    name: "Order Staff",
    email: `order-staff-${Date.now()}@example.com`,
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

  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

// Authentication tests
dbTests("1. unauthenticated GET orders returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/orders`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

dbTests("2. unauthenticated POST order returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: new mongoose.Types.ObjectId().toString(),
      items: [{ product: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

// GET listing tests
dbTests("3. admin can list orders", async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.orders));
  assert.ok(body.data.pagination);
  assert.equal(typeof body.data.pagination.page, "number");
  assert.equal(typeof body.data.pagination.total, "number");
});

dbTests("4. staff can list orders", async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.orders));
});

dbTests("5. pagination works for orders", async () => {
  await Order.deleteMany({});
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 50 });

  // Create 3 orders
  for (let i = 0; i < 3; i++) {
    await Order.create({
      customer: cust._id,
      items: [{ product: prod._id, quantity: 1, price: 100 }],
      totalAmount: 100,
      status: "pending",
    });
  }

  const res1 = await fetch(`${baseUrl}/api/orders?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body1 = await res1.json();
  assert.equal(res1.status, 200);
  assert.equal(body1.data.orders.length, 2);
  assert.equal(body1.data.pagination.page, 1);
  assert.equal(body1.data.pagination.limit, 2);
  assert.equal(body1.data.pagination.total, 3);
  assert.equal(body1.data.pagination.totalPages, 2);

  const res2 = await fetch(`${baseUrl}/api/orders?page=2&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body2 = await res2.json();
  assert.equal(res2.status, 200);
  assert.equal(body2.data.orders.length, 1);
  assert.equal(body2.data.pagination.page, 2);
});

dbTests("6. status filter works for orders", async () => {
  await Order.deleteMany({});
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 50 });

  await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "pending",
  });
  await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "completed",
  });

  const res = await fetch(`${baseUrl}/api/orders?status=pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.orders.length, 1);
  assert.equal(body.data.orders[0].status, "pending");
});

dbTests("7. customer filter works for orders", async () => {
  const custA = await createCustomerHelper({ name: "Cust A" });
  const custB = await createCustomerHelper({ name: "Cust B" });
  const prod = await createProductHelper({ stock: 50 });

  await Order.create({
    customer: custA._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "pending",
  });

  const res = await fetch(`${baseUrl}/api/orders?customer=${custA._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.orders.length, 1);
  assert.equal(body.data.orders[0].customer._id, custA._id.toString());
});

dbTests("8. sorting works by totalAmount", async () => {
  await Order.deleteMany({});
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 50 });

  await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 50 }],
    totalAmount: 50,
    status: "pending",
  });
  await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 200 }],
    totalAmount: 200,
    status: "pending",
  });

  const ascRes = await fetch(
    `${baseUrl}/api/orders?sortBy=totalAmount&sortOrder=asc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const ascBody = await ascRes.json();
  assert.equal(ascRes.status, 200);
  assert.equal(ascBody.data.orders[0].totalAmount, 50);

  const descRes = await fetch(
    `${baseUrl}/api/orders?sortBy=totalAmount&sortOrder=desc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const descBody = await descRes.json();
  assert.equal(descRes.status, 200);
  assert.equal(descBody.data.orders[0].totalAmount, 200);
});

// GET single order
dbTests("9. get order by ID works with populated customer and product", async () => {
  const cust = await createCustomerHelper({ name: "Single Order Cust" });
  const prod = await createProductHelper({ name: "Populated Laptop", price: 1200 });

  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 2, price: 1200 }],
    totalAmount: 2400,
    status: "pending",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.order._id, order._id.toString());
  assert.equal(body.data.order.customer.name, "Single Order Cust");
  assert.equal(body.data.order.items[0].product.name, "Populated Laptop");
  assert.equal(body.data.order.items[0].price, 1200);
});

dbTests("10. malformed order ID returns 400", async () => {
  const response = await fetch(`${baseUrl}/api/orders/not-a-valid-id`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors);
});

dbTests("11. missing order returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/orders/${fakeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Order not found");
});

// POST order tests
dbTests("12. admin can create order", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ price: 150, stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 2 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.order.totalAmount, 300);
  assert.equal(body.data.order.status, "pending");
});

dbTests("13. staff can create order", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ price: 80, stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.order.totalAmount, 80);
});

dbTests("14. valid multiple-item order works", async () => {
  const cust = await createCustomerHelper();
  const prodA = await createProductHelper({ price: 100, stock: 10 });
  const prodB = await createProductHelper({ price: 250, stock: 5 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [
        { product: prodA._id.toString(), quantity: 2 },
        { product: prodB._id.toString(), quantity: 1 },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.order.items.length, 2);
  assert.equal(body.data.order.totalAmount, 450); // (100*2) + (250*1)
});

dbTests("15. totalAmount is calculated by backend", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ price: 75, stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 3 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.order.totalAmount, 225);
});

dbTests("16. price snapshot is stored and immune to future product price change", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ price: 1500, stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.data.order.items[0].price, 1500);

  // Update the product price to 2000
  prod.price = 2000;
  await prod.save();

  // Fetch the order again
  const orderCheck = await Order.findById(body.data.order._id);
  assert.equal(orderCheck.items[0].price, 1500);
  assert.equal(orderCheck.totalAmount, 1500);
});

dbTests("17. client-provided totalAmount cannot manipulate total", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ price: 50, stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 2 }],
      totalAmount: 1, // Malicious attempt to pay only 1
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.order.totalAmount, 100); // 50 * 2 = 100, not 1
});

dbTests("18. invalid customer rejected", async () => {
  const fakeCustId = new mongoose.Types.ObjectId().toString();
  const prod = await createProductHelper();

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: fakeCustId,
      items: [{ product: prod._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.message, "Customer not found");
});

dbTests("19. inactive customer rejected", async () => {
  const inactiveCust = await createCustomerHelper({ status: "inactive" });
  const prod = await createProductHelper();

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: inactiveCust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /inactive/i);
});

dbTests("20. invalid product rejected", async () => {
  const cust = await createCustomerHelper();
  const fakeProdId = new mongoose.Types.ObjectId().toString();

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: fakeProdId, quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.message, /Product not found/i);
});

dbTests("21. inactive product rejected", async () => {
  const cust = await createCustomerHelper();
  const inactiveProd = await createProductHelper({ status: "inactive", stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: inactiveProd._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /inactive/i);
});

dbTests("22. out_of_stock product rejected", async () => {
  const cust = await createCustomerHelper();
  const oosProd = await createProductHelper({ status: "out_of_stock", stock: 0 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: oosProd._id.toString(), quantity: 1 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /out of stock/i);
});

dbTests("23. insufficient stock rejected", async () => {
  const cust = await createCustomerHelper();
  const lowStockProd = await createProductHelper({ stock: 4 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: lowStockProd._id.toString(), quantity: 10 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Insufficient stock/i);
});

dbTests("24. invalid quantity rejected", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 0 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

dbTests("25. decimal quantity rejected", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 2.5 }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

dbTests("26. duplicate product entries in same order rejected", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 20 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [
        { product: prod._id.toString(), quantity: 2 },
        { product: prod._id.toString(), quantity: 3 },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.errors[0].message, /Duplicate products/i);
});

dbTests("27. stock decreases correctly upon order creation", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 10 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 3 }],
    }),
  });
  assert.equal(response.status, 201);

  const updatedProd = await Product.findById(prod._id);
  assert.equal(updatedProd.stock, 7);
  assert.equal(updatedProd.status, "active");
});

dbTests("28. stock reaching zero changes product to out_of_stock", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 5 });

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 5 }],
    }),
  });
  assert.equal(response.status, 201);

  const updatedProd = await Product.findById(prod._id);
  assert.equal(updatedProd.stock, 0);
  assert.equal(updatedProd.status, "out_of_stock");
});

// Status progression tests
dbTests("29. pending to processing works", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "pending",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "processing" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.order.status, "processing");
});

dbTests("30. processing to completed works", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "processing",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "completed" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.order.status, "completed");
});

dbTests("31. pending to cancelled works", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 5 });
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 2, price: 100 }],
    totalAmount: 200,
    status: "pending",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.order.status, "cancelled");
});

dbTests("32. processing to cancelled works", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 5 });
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 2, price: 100 }],
    totalAmount: 200,
    status: "processing",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.order.status, "cancelled");
});

dbTests("33. invalid transition rejected (e.g. pending to completed directly)", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "pending",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "completed" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Cannot transition order status/i);
});

dbTests("34. completed cannot transition", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "completed",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Cannot transition/i);
});

dbTests("35. cancelled cannot transition", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "cancelled",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "processing" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Cannot transition/i);
});

// Cancellation and inventory restoration
dbTests("36. cancelling an order restores stock", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 5 });

  // Create order for 3 items -> stock becomes 2
  const createRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 3 }],
    }),
  });
  const createBody = await createRes.json();
  const orderId = createBody.data.order._id;

  const prodAfterOrder = await Product.findById(prod._id);
  assert.equal(prodAfterOrder.stock, 2);

  // Cancel order -> stock should restore to 5
  const cancelRes = await fetch(`${baseUrl}/api/orders/${orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  assert.equal(cancelRes.status, 200);

  const prodAfterCancel = await Product.findById(prod._id);
  assert.equal(prodAfterCancel.stock, 5);
});

dbTests("37. cancelled order cannot restore stock twice", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 10 });

  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 2, price: 50 }],
    totalAmount: 100,
    status: "cancelled",
  });

  // Trying to cancel an already cancelled order
  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await response.json();

  // It's the same status, so no stock restored
  const prodCheck = await Product.findById(prod._id);
  assert.equal(prodCheck.stock, 10);
});

// DELETE tests
dbTests("38. non-existing order deletion returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/orders/${fakeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
});

dbTests("39. completed order deletion rejected", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper();
  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 1, price: 50 }],
    totalAmount: 50,
    status: "completed",
  });

  const response = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Completed orders cannot be deleted/i);
});

dbTests("40. deleting pending order restores stock", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 10 });

  // Create order deducting 4 stock -> 6
  const createRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [{ product: prod._id.toString(), quantity: 4 }],
    }),
  });
  const createBody = await createRes.json();
  const orderId = createBody.data.order._id;

  const prodAfterOrder = await Product.findById(prod._id);
  assert.equal(prodAfterOrder.stock, 6);

  // Delete pending order -> restores 4 stock -> 10
  const deleteRes = await fetch(`${baseUrl}/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteRes.status, 200);

  const prodAfterDelete = await Product.findById(prod._id);
  assert.equal(prodAfterDelete.stock, 10);

  const orderCheck = await Order.findById(orderId);
  assert.equal(orderCheck, null);
});

dbTests("41. deleting cancelled order does not duplicate stock restoration", async () => {
  const cust = await createCustomerHelper();
  const prod = await createProductHelper({ stock: 10 });

  const order = await Order.create({
    customer: cust._id,
    items: [{ product: prod._id, quantity: 3, price: 50 }],
    totalAmount: 150,
    status: "cancelled",
  });

  const deleteRes = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteRes.status, 200);

  // Stock should remain 10, not become 13
  const prodCheck = await Product.findById(prod._id);
  assert.equal(prodCheck.stock, 10);
});

// Section 27: Transaction Atomicity Test
dbTests("42. transaction test: multi-product order failure leaves no partial stock deductions", async () => {
  const cust = await createCustomerHelper();
  const prodA = await createProductHelper({ name: "Stock Product A", stock: 10, price: 100 });
  const prodB = await createProductHelper({ name: "Stock Product B", stock: 2, price: 100 });

  // Try creating an order requesting 3 of prodA and 5 of prodB (prodB only has 2)
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customer: cust._id.toString(),
      items: [
        { product: prodA._id.toString(), quantity: 3 },
        { product: prodB._id.toString(), quantity: 5 },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Insufficient stock/i);

  // Verify stock was not partially deducted from prodA
  const freshProdA = await Product.findById(prodA._id);
  const freshProdB = await Product.findById(prodB._id);
  assert.equal(freshProdA.stock, 10);
  assert.equal(freshProdB.stock, 2);

  // Verify no order document was created
  const orderCount = await Order.countDocuments({ customer: cust._id });
  assert.equal(orderCount, 0);
});
