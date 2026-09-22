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
const Product = (await import("../src/models/Product.js")).default;
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
    email: `product-admin-${Date.now()}@example.com`,
    role: "admin",
  });
  adminToken = generateToken({ userId: admin._id, role: admin.role });

  const staff = await createUser({
    name: "Staff User",
    email: `product-staff-${Date.now()}@example.com`,
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
dbTests("1. unauthenticated GET /api/products returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

dbTests("2. unauthenticated POST /api/products returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Product 1",
      category: "Hardware",
      price: 100,
      stock: 5,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

// GET listing tests
dbTests("3. admin can list products", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.products));
  assert.ok(body.data.pagination);
  assert.equal(typeof body.data.pagination.page, "number");
  assert.equal(typeof body.data.pagination.total, "number");
});

dbTests("4. staff can list products", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.products));
});

dbTests("5. search works across name, description, and category", async () => {
  await Product.deleteMany({});

  await Product.create([
    {
      name: "Ultra Pro Gaming Laptop",
      description: "High end machine with RTX graphics",
      category: "Computers",
      price: 1999,
      stock: 10,
      status: "active",
    },
    {
      name: "Ergonomic Office Chair",
      description: "Comfortable mesh chair for long working hours",
      category: "Furniture",
      price: 250,
      stock: 20,
      status: "active",
    },
    {
      name: "Mechanical Keyboard",
      description: "Clicky switches with RGB backlight for gaming setups",
      category: "Accessories",
      price: 90,
      stock: 0,
      status: "out_of_stock",
    },
  ]);

  // Search by name
  const nameRes = await fetch(`${baseUrl}/api/products?search=laptop`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const nameBody = await nameRes.json();
  assert.equal(nameRes.status, 200);
  assert.equal(nameBody.data.products.length, 1);
  assert.equal(nameBody.data.products[0].name, "Ultra Pro Gaming Laptop");

  // Search by description ("mesh")
  const descRes = await fetch(`${baseUrl}/api/products?search=mesh`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const descBody = await descRes.json();
  assert.equal(descRes.status, 200);
  assert.equal(descBody.data.products.length, 1);
  assert.equal(descBody.data.products[0].name, "Ergonomic Office Chair");

  // Search by category ("Furniture")
  const catSearchRes = await fetch(`${baseUrl}/api/products?search=furniture`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const catSearchBody = await catSearchRes.json();
  assert.equal(catSearchRes.status, 200);
  assert.equal(catSearchBody.data.products.length, 1);
  assert.equal(catSearchBody.data.products[0].category, "Furniture");
});

dbTests("6. category filter works", async () => {
  const response = await fetch(`${baseUrl}/api/products?category=Furniture`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.products.length, 1);
  assert.equal(body.data.products[0].category, "Furniture");
});

dbTests("7. status filter works for active and out_of_stock", async () => {
  const activeRes = await fetch(`${baseUrl}/api/products?status=active`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const activeBody = await activeRes.json();
  assert.equal(activeRes.status, 200);
  assert.equal(
    activeBody.data.products.every((p) => p.status === "active"),
    true,
  );
  assert.equal(activeBody.data.products.length, 2);

  const outOfStockRes = await fetch(
    `${baseUrl}/api/products?status=out_of_stock`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const outOfStockBody = await outOfStockRes.json();
  assert.equal(outOfStockRes.status, 200);
  assert.equal(outOfStockBody.data.products.length, 1);
  assert.equal(outOfStockBody.data.products[0].status, "out_of_stock");
});

dbTests("8. pagination works with page and limit", async () => {
  const res = await fetch(`${baseUrl}/api/products?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.data.products.length, 2);
  assert.equal(body.data.pagination.page, 1);
  assert.equal(body.data.pagination.limit, 2);
  assert.equal(body.data.pagination.total, 3);
  assert.equal(body.data.pagination.totalPages, 2);

  const page2Res = await fetch(`${baseUrl}/api/products?page=2&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const page2Body = await page2Res.json();
  assert.equal(page2Res.status, 200);
  assert.equal(page2Body.data.products.length, 1);
  assert.equal(page2Body.data.pagination.page, 2);
});

dbTests("9. sorting works by price ascending and descending", async () => {
  const ascRes = await fetch(
    `${baseUrl}/api/products?sortBy=price&sortOrder=asc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const ascBody = await ascRes.json();
  assert.equal(ascRes.status, 200);
  assert.equal(ascBody.data.products[0].name, "Mechanical Keyboard"); // price 90

  const descRes = await fetch(
    `${baseUrl}/api/products?sortBy=price&sortOrder=desc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const descBody = await descRes.json();
  assert.equal(descRes.status, 200);
  assert.equal(descBody.data.products[0].name, "Ultra Pro Gaming Laptop"); // price 1999
});

// GET single product by ID
dbTests("10. get product by ID works", async () => {
  const created = await Product.create({
    name: "Wireless Mouse",
    category: "Accessories",
    price: 45,
    stock: 50,
  });

  const response = await fetch(`${baseUrl}/api/products/${created._id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.product._id, created._id.toString());
  assert.equal(body.data.product.name, "Wireless Mouse");
});

dbTests("11. malformed ID returns 400", async () => {
  const response = await fetch(`${baseUrl}/api/products/bad-id-123`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors);
});

dbTests("12. missing product returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/products/${fakeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Product not found");
});

// POST product tests
dbTests("13. admin can create product", async () => {
  const productData = {
    name: "4K Monitor",
    description: "32-inch IPS UHD display",
    category: "Displays",
    price: 450,
    stock: 15,
    status: "active",
  };

  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(productData),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.message, "Product created successfully");
  assert.equal(body.data.product.name, productData.name);
  assert.equal(body.data.product.price, 450);
  assert.equal(body.data.product.stock, 15);
  assert.equal(body.data.product.status, "active");
});

dbTests("14. staff can create product", async () => {
  const productData = {
    name: "USB-C Hub",
    category: "Accessories",
    price: 35,
    stock: 25,
  };

  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(productData),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.product.status, "active"); // Defaults to active
});

dbTests("15. missing required fields rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Only Name Given",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors));
});

dbTests("16. negative price rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Negative Price Item",
      category: "Test",
      price: -10,
      stock: 5,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors.some((e) => e.field === "price"));
});

dbTests("17. negative stock rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Negative Stock Item",
      category: "Test",
      price: 10,
      stock: -5,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors.some((e) => e.field === "stock"));
});

dbTests("18. decimal stock rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Decimal Stock Item",
      category: "Test",
      price: 10,
      stock: 5.5,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors.some((e) => e.field === "stock"));
});

dbTests("19. invalid status rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Invalid Status Item",
      category: "Test",
      price: 10,
      stock: 5,
      status: "discontinued",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors.some((e) => e.field === "status"));
});

dbTests("product with 0 stock defaults to out_of_stock status", async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Zero Stock Item",
      category: "Test",
      price: 10,
      stock: 0,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.product.status, "out_of_stock");
});

// PUT product tests
dbTests("20. admin can update product", async () => {
  const product = await Product.create({
    name: "Old Product Admin",
    category: "Hardware",
    price: 100,
    stock: 10,
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Updated Product Admin",
      price: 120,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Product updated successfully");
  assert.equal(body.data.product.name, "Updated Product Admin");
  assert.equal(body.data.product.price, 120);
});

dbTests("21. staff can update product", async () => {
  const product = await Product.create({
    name: "Old Product Staff",
    category: "Hardware",
    price: 50,
    stock: 5,
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      category: "Upgraded Hardware",
      stock: 8,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.product.category, "Upgraded Hardware");
  assert.equal(body.data.product.stock, 8);
});

dbTests("22. invalid update rejected", async () => {
  const product = await Product.create({
    name: "Product For Invalid Update",
    category: "Misc",
    price: 25,
    stock: 10,
  });

  // Empty update body
  const emptyRes = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(emptyRes.status, 400);

  // Negative price
  const negPriceRes = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ price: -5 }),
  });
  assert.equal(negPriceRes.status, 400);

  // Decimal stock
  const decStockRes = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ stock: 3.14 }),
  });
  assert.equal(decStockRes.status, 400);
});

dbTests("updating stock to 0 sets status to out_of_stock", async () => {
  const product = await Product.create({
    name: "Product Depletion Test",
    category: "Misc",
    price: 20,
    stock: 5,
    status: "active",
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ stock: 0 }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.product.stock, 0);
  assert.equal(body.data.product.status, "out_of_stock");
});

dbTests("increasing stock preserves inactive status", async () => {
  const product = await Product.create({
    name: "Inactive Product Restock",
    category: "Misc",
    price: 30,
    stock: 0,
    status: "inactive",
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ stock: 10 }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.product.stock, 10);
  assert.equal(body.data.product.status, "inactive");
});

dbTests("23. missing product update returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/products/${fakeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ price: 99 }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Product not found");
});

// DELETE product tests
dbTests("24. admin can delete product", async () => {
  const product = await Product.create({
    name: "Delete Admin Target",
    category: "Temp",
    price: 10,
    stock: 1,
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Product deleted successfully");

  const check = await Product.findById(product._id);
  assert.equal(check, null);
});

dbTests("25. staff can delete product", async () => {
  const product = await Product.create({
    name: "Delete Staff Target",
    category: "Temp",
    price: 15,
    stock: 2,
  });

  const response = await fetch(`${baseUrl}/api/products/${product._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Product deleted successfully");

  const check = await Product.findById(product._id);
  assert.equal(check, null);
});

dbTests("26. missing product delete returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/products/${fakeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "Product not found");
});
