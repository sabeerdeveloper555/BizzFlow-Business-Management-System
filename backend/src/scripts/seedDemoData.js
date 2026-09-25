import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { createOrder, updateOrderStatus } from "../services/orderService.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });

/**
 * Adds demo data to Customers, Products, Orders and Staff.
 *
 * The script is add-only and idempotent: records are matched on their unique
 * keys (email / name+category) and skipped when they already exist, so running
 * it twice never creates duplicates and never edits or removes existing data.
 *
 * Run with: npm run seed   (from the backend folder)
 */

const DEMO_PASSWORD = "Demo1234!";

const products = [
  { name: "Wireless Mouse", category: "Electronics", price: 1800, stock: 45, status: "active", description: "Compact 2.4G wireless mouse with adjustable DPI." },
  { name: "24 inch LED Monitor", category: "Electronics", price: 26500, stock: 12, status: "active", description: "Full HD IPS panel with 75Hz refresh rate." },
  { name: "USB-C Docking Station", category: "Electronics", price: 8900, stock: 7, status: "active", description: "10-in-1 dock with HDMI, Ethernet and PD charging." },
  { name: "Mechanical Keyboard RGB", category: "Electronics", price: 9200, stock: 0, status: "out_of_stock", description: "Hot-swappable switches with per-key RGB lighting." },
  { name: "Ergonomic Office Chair", category: "Furniture", price: 18500, stock: 15, status: "active", description: "Lumbar support mesh chair with adjustable armrests." },
  { name: "Standing Desk 120x60", category: "Furniture", price: 32000, stock: 6, status: "active", description: "Electric height adjustable desk with memory presets." },
  { name: "Oak Bookshelf 4-Tier", category: "Furniture", price: 14750, stock: 3, status: "active", description: "Solid oak shelving unit, 4 tiers." },
  { name: "Refurbished Filing Cabinet", category: "Furniture", price: 6500, stock: 4, status: "inactive", description: "Three-drawer steel cabinet, refurbished (discontinued line)." },
  { name: "A4 Copy Paper (Ream)", category: "Stationery", price: 650, stock: 320, status: "active", description: "500 sheets, 80gsm bright white." },
  { name: "Gel Pen Set (10 pcs)", category: "Stationery", price: 480, stock: 150, status: "active", description: "0.5mm quick-dry gel pens, mixed colours." },
  { name: "Whiteboard Markers Kit", category: "Stationery", price: 1250, stock: 60, status: "active", description: "Set of 12 low-odour dry erase markers." },
  { name: "Noise Cancelling Headset", category: "Accessories", price: 12400, stock: 18, status: "active", description: "Over-ear Bluetooth headset with ANC and boom mic." },
  { name: "Laptop Backpack 15.6 inch", category: "Accessories", price: 4200, stock: 25, status: "active", description: "Water-resistant backpack with padded laptop sleeve." },
  { name: "Power Bank 20000mAh", category: "Accessories", price: 5600, stock: 9, status: "active", description: "Dual-output power bank with fast charging." },
  { name: "Antivirus Pro License (1Y)", category: "Software", price: 7900, stock: 100, status: "active", description: "Annual device licence, 5 endpoints." },
  { name: "Project Mgmt Suite License", category: "Software", price: 15500, stock: 40, status: "active", description: "Annual team licence for up to 20 users." },
  { name: "Espresso Coffee Machine", category: "Appliances", price: 39900, stock: 2, status: "active", description: "15-bar pump machine with milk frother." },
];

const customers = [
  { name: "Fatima Sheikh", email: "fatima.sheikh@example.com", phone: "+92 300 0000005", company: "Sheikh Textiles", address: "Plot 12, Shahrah-e-Faisal, Karachi", status: "active" },
  { name: "Bilal Hassan", email: "bilal.hassan@example.com", phone: "+92 321 0000006", company: "Hassan Electronics", address: "Shop 4, Hall Road, Lahore", status: "active" },
  { name: "Ayesha Malik", email: "ayesha.malik@example.com", phone: "+92 333 0000007", company: "Malik Interiors", address: "House 78, DHA Phase 5, Lahore", status: "active" },
  { name: "Usman Raza", email: "usman.raza@example.com", phone: "+92 345 0000008", company: "Raza Logistics", address: "Gate 3, Sunnari, Karachi", status: "active" },
  { name: "Hina Qureshi", email: "hina.qureshi@example.com", phone: "+92 302 0000009", company: "Qureshi Traders", address: "Main Boulevard, Gulberg III, Lahore", status: "active" },
  { name: "Ali Zafar", email: "ali.zafar@example.com", phone: "+92 311 0000010", company: "Zafar Steel", address: "SITE Area, Block 9, Karachi", status: "inactive" },
  { name: "Sana Iqbal", email: "sana.iqbal@example.com", phone: "+92 301 0000011", company: "Iqbal Foods", address: "Commercial Market, Bahria Town, Rawalpindi", status: "active" },
  { name: "Danish Warraich", email: "danish.warraich@example.com", phone: "+92 321 0000012", company: "Warraich Autos", address: "Ferozepur Road, Lahore", status: "active" },
  { name: "Mahnoor Baig", email: "mahnoor.baig@example.com", phone: "+92 335 0000013", company: "Baig Pharma", address: "Scheme 3, Clifton, Karachi", status: "active" },
  { name: "Kamran Yousaf", email: "kamran.yousaf@example.com", phone: "+92 300 0000014", company: "Yousaf Builders", address: "Blue Area, Islamabad", status: "inactive" },
  { name: "Rabia Anwar", email: "rabia.anwar@example.com", phone: "+92 347 0000015", company: "Anwar Cosmetics", address: "Channel View, Faisalabad", status: "active" },
  { name: "Ana Garcia", email: "ana.garcia@example.com", phone: "+34 600 000016", company: "Garcia Import Export", address: "Calle Mayor 21, Madrid, Spain", status: "active" },
  { name: "Tariq Mehmood", email: "tariq.mehmood@example.com", phone: "+92 313 0000017", company: "Mehmood Store", status: "active" },
  { name: "Zoya Khan", email: "zoya.khan@example.com", phone: "+92 308 0000018", address: "Apartment 5C, Bath Island, Karachi", status: "active" },
];

const staffMembers = [
  { name: "Nadia Aslam", email: "nadia.aslam@bizflow.com", role: "staff", status: "active" },
  { name: "Imran Siddiqui", email: "imran.siddiqui@bizflow.com", role: "staff", status: "active" },
  { name: "Mehwish Tariq", email: "mehwish.tariq@bizflow.com", role: "staff", status: "active" },
  { name: "Faisal Mahmood", email: "faisal.mahmood@bizflow.com", role: "staff", status: "inactive" },
  { name: "Sara Javed", email: "sara.javed@bizflow.com", role: "staff", status: "active" },
  { name: "Junaid Ahmed", email: "junaid.ahmed@bizflow.com", role: "staff", status: "active" },
  { name: "Amna Rauf", email: "amna.rauf@bizflow.com", role: "staff", status: "inactive" },
  { name: "Zeeshan Haider", email: "zeeshan.haider@bizflow.com", role: "admin", status: "active" },
];

/** Items reference products by name; customer references a customer email. */
const orders = [
  { customer: "fatima.sheikh@example.com", items: [["24 inch LED Monitor", 2]], status: "completed", daysAgo: 26 },
  { customer: "fatima.sheikh@example.com", items: [["A4 Copy Paper (Ream)", 40], ["Gel Pen Set (10 pcs)", 15]], status: "completed", daysAgo: 19 },
  { customer: "fatima.sheikh@example.com", items: [["USB-C Docking Station", 1]], status: "processing", daysAgo: 4 },
  { customer: "bilal.hassan@example.com", items: [["Wireless Mouse", 12]], status: "completed", daysAgo: 24 },
  { customer: "bilal.hassan@example.com", items: [["Noise Cancelling Headset", 3], ["Power Bank 20000mAh", 4]], status: "completed", daysAgo: 15 },
  { customer: "bilal.hassan@example.com", items: [["24 inch LED Monitor", 1]], status: "pending", daysAgo: 2 },
  { customer: "bilal.hassan@example.com", items: [["Laptop Backpack 15.6 inch", 6]], status: "cancelled", daysAgo: 9 },
  { customer: "ayesha.malik@example.com", items: [["Ergonomic Office Chair", 8]], status: "completed", daysAgo: 22 },
  { customer: "ayesha.malik@example.com", items: [["Standing Desk 120x60", 2], ["Oak Bookshelf 4-Tier", 1]], status: "processing", daysAgo: 5 },
  { customer: "ayesha.malik@example.com", items: [["Whiteboard Markers Kit", 10]], status: "pending", daysAgo: 1 },
  { customer: "usman.raza@example.com", items: [["Project Mgmt Suite License", 6]], status: "completed", daysAgo: 20 },
  { customer: "usman.raza@example.com", items: [["Antivirus Pro License (1Y)", 12]], status: "completed", daysAgo: 11 },
  { customer: "usman.raza@example.com", items: [["USB-C Docking Station", 2]], status: "cancelled", daysAgo: 7 },
  { customer: "hina.qureshi@example.com", items: [["A4 Copy Paper (Ream)", 120], ["Whiteboard Markers Kit", 20]], status: "completed", daysAgo: 18 },
  { customer: "hina.qureshi@example.com", items: [["Espresso Coffee Machine", 1]], status: "processing", daysAgo: 3 },
  { customer: "hina.qureshi@example.com", items: [["Gel Pen Set (10 pcs)", 30]], status: "pending", daysAgo: 2 },
  { customer: "sana.iqbal@example.com", items: [["Laptop Backpack 15.6 inch", 4], ["Wireless Mouse", 5]], status: "completed", daysAgo: 16 },
  { customer: "sana.iqbal@example.com", items: [["Noise Cancelling Headset", 1]], status: "cancelled", daysAgo: 6 },
  { customer: "danish.warraich@example.com", items: [["Antivirus Pro License (1Y)", 3]], status: "completed", daysAgo: 13 },
  { customer: "danish.warraich@example.com", items: [["Standing Desk 120x60", 1], ["Ergonomic Office Chair", 2]], status: "processing", daysAgo: 4 },
  { customer: "mahnoor.baig@example.com", items: [["Noise Cancelling Headset", 2]], status: "pending", daysAgo: 1 },
  { customer: "mahnoor.baig@example.com", items: [["Project Mgmt Suite License", 2]], status: "completed", daysAgo: 10 },
  { customer: "rabia.anwar@example.com", items: [["Whiteboard Markers Kit", 8], ["A4 Copy Paper (Ream)", 25]], status: "completed", daysAgo: 8 },
  { customer: "rabia.anwar@example.com", items: [["Espresso Coffee Machine", 1]], status: "cancelled", daysAgo: 5 },
  { customer: "ana.garcia@example.com", items: [["Power Bank 20000mAh", 3]], status: "completed", daysAgo: 12 },
  { customer: "ana.garcia@example.com", items: [["Wireless Mouse", 3]], status: "pending", daysAgo: 1 },
  { customer: "tariq.mehmood@example.com", items: [["Gel Pen Set (10 pcs)", 12], ["Laptop Backpack 15.6 inch", 2]], status: "processing", daysAgo: 3 },
  { customer: "zoya.khan@example.com", items: [["Oak Bookshelf 4-Tier", 1]], status: "completed", daysAgo: 14 },
];

const statusTransitions = {
  pending: [],
  processing: ["processing"],
  completed: ["processing", "completed"],
  cancelled: ["cancelled"],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgoDate = (days) => new Date(Date.now() - days * DAY_MS);

/** Evenly spread `length` records across an age window, oldest first. */
const spreadDate = (index, length, oldestDays, newestDays) => {
  const step = length > 1 ? (oldestDays - newestDays) / (length - 1) : 0;
  return daysAgoDate(Math.round(oldestDays - index * step));
};

/**
 * Mongoose treats `createdAt` as immutable, so timestamps have to be written
 * through the native driver to backdate demo records.
 */
const backdate = (model, id, createdAt) =>
  model.collection.updateOne({ _id: id }, { $set: { createdAt, updatedAt: createdAt } });

const seedProducts = async () => {
  let created = 0;

  for (const [index, product] of products.entries()) {
    const existing = await Product.findOne({ name: product.name, category: product.category });
    if (existing) continue;
    const doc = await Product.create(product);
    await backdate(Product, doc._id, spreadDate(index, products.length, 90, 20));
    created += 1;
  }

  console.log(`Products: ${created} added, ${products.length - created} already present`);
};

const seedCustomers = async () => {
  let created = 0;

  for (const [index, customer] of customers.entries()) {
    const existing = await Customer.findOne({ email: customer.email });
    if (existing) continue;
    const doc = await Customer.create(customer);
    await backdate(Customer, doc._id, spreadDate(index, customers.length, 120, 30));
    created += 1;
  }

  console.log(`Customers: ${created} added, ${customers.length - created} already present`);
};

const seedStaff = async () => {
  let created = 0;
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const [index, member] of staffMembers.entries()) {
    const existing = await User.findOne({ email: member.email });
    if (existing) continue;
    const doc = await User.create({ ...member, password: hashedPassword });
    await backdate(User, doc._id, spreadDate(index, staffMembers.length, 200, 40));
    created += 1;
  }

  console.log(`Staff: ${created} added, ${staffMembers.length - created} already present`);
};

const seedOrders = async () => {
  const [productRefs, customerRefs] = await Promise.all([
    Product.find({ name: { $in: products.map((p) => p.name) } }, "name stock status"),
    Customer.find({ email: { $in: customers.map((c) => c.email) } }, "email status"),
  ]);

  const productByName = new Map(productRefs.map((p) => [p.name, p]));
  const customerByEmail = new Map(customerRefs.map((c) => [c.email, c]));

  // Orders have no unique key, so use the first seeded product as the marker:
  // any order referencing it means this demo batch was already created.
  const markerProduct = productByName.get(products[0].name);
  if (markerProduct) {
    const alreadySeeded = await Order.exists({ "items.product": markerProduct._id });
    if (alreadySeeded) {
      console.log("Orders: 0 added, demo batch already present");
      return;
    }
  }

  // Track remaining stock locally so later orders never plan against stock an
  // earlier order already consumed.
  const remainingStock = new Map(
    [...productByName.values()].map((p) => [p._id.toString(), p.stock]),
  );

  let created = 0;
  let skipped = 0;

  for (const spec of orders) {
    const customer = customerByEmail.get(spec.customer);
    if (!customer || customer.status !== "active") {
      skipped += 1;
      continue;
    }

    const items = [];
    const reserved = [];
    let viable = true;

    for (const [name, quantity] of spec.items) {
      const product = productByName.get(name);
      const available = product ? remainingStock.get(product._id.toString()) : undefined;
      if (!product || product.status !== "active" || available < quantity) {
        viable = false;
        break;
      }
      items.push({ product: product._id, quantity });
      reserved.push({ id: product._id.toString(), quantity });
    }

    if (!viable) {
      skipped += 1;
      continue;
    }

    try {
      const order = await createOrder({ customer: customer._id, items });

      for (const status of statusTransitions[spec.status]) {
        await updateOrderStatus(order._id, status);
      }

      // Backdate so the dashboard shows a realistic spread over time.
      await backdate(Order, order._id, daysAgoDate(spec.daysAgo));

      // Cancelled orders give their stock back, so only keep the deduction for
      // the statuses that consume it.
      if (spec.status !== "cancelled") {
        reserved.forEach(({ id, quantity }) => {
          remainingStock.set(id, remainingStock.get(id) - quantity);
        });
      }

      created += 1;
    } catch (error) {
      console.warn(`  skipped order for ${spec.customer}: ${error.message}`);
      skipped += 1;
    }
  }

  console.log(`Orders: ${created} added, ${skipped} skipped (stock/status limits)`);
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in backend/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Seeding database "${mongoose.connection.name}"\n`);

  await seedProducts();
  await seedCustomers();
  await seedStaff();
  await seedOrders();

  await mongoose.disconnect();
  console.log(`\nDone. Demo staff password for every new account: ${DEMO_PASSWORD}`);
};

// Only run when executed directly, so the demo data stays importable.
// Windows drive letters differ in casing between argv and import.meta.url.
const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() ===
    import.meta.url.toLowerCase();

if (isDirectRun) {
  main().catch(async (error) => {
    console.error("Seed failed:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

export { products, customers, staffMembers, orders, spreadDate, daysAgoDate, backdate };
