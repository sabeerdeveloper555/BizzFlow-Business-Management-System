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
const generateToken = (await import("../src/utils/generateToken.js")).default;

const dbTests = mongoServer ? test : test.skip;
let baseUrl;
let server;

let adminUser;
let adminToken;
let staffUser;
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
    email: email || `user-${Date.now()}-${Math.random()}@example.com`,
    password: hashedPassword,
    role,
    status,
  });
};

test.before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  adminUser = await createUser({
    name: "Primary Admin",
    email: `primary-admin-${Date.now()}@example.com`,
    role: "admin",
  });
  adminToken = generateToken({ userId: adminUser._id, role: adminUser.role });

  staffUser = await createUser({
    name: "Primary Staff",
    email: `primary-staff-${Date.now()}@example.com`,
    role: "staff",
  });
  staffToken = generateToken({ userId: staffUser._id, role: staffUser.role });
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

// 1. Authentication & RBAC tests
dbTests("1. unauthenticated GET /api/users returns 401", async () => {
  const response = await fetch(`${baseUrl}/api/users`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
});

dbTests("2. staff GET /api/users returns 403 Forbidden", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission/i);
});

dbTests("3. staff POST /api/users returns 403 Forbidden", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      name: "New Staff",
      email: "newstaff@example.com",
      password: "password123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
});

dbTests("4. staff PUT /api/users/:id returns 403 Forbidden", async () => {
  const response = await fetch(`${baseUrl}/api/users/${staffUser._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ name: "Updated Name" }),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
});

dbTests(
  "5. staff PATCH /api/users/:id/status returns 403 Forbidden",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/users/${staffUser._id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: "inactive" }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  },
);

dbTests("6. staff DELETE /api/users/:id returns 403 Forbidden", async () => {
  const response = await fetch(`${baseUrl}/api/users/${staffUser._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
});

// 2. Listing tests
dbTests("7. admin can list staff users", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.users));
  assert.ok(body.data.pagination);
  assert.equal(typeof body.data.pagination.page, "number");
  assert.equal(typeof body.data.pagination.total, "number");
});

dbTests("8. user listing supports role filtering", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.data.users.some((u) => u.role === "admin"));

  const staffResponse = await fetch(`${baseUrl}/api/users?role=staff`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const staffBody = await staffResponse.json();
  assert.equal(staffResponse.status, 200);
  assert.equal(
    staffBody.data.users.every((u) => u.role === "staff"),
    true,
  );

  const adminResponse = await fetch(`${baseUrl}/api/users?role=admin`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminBody = await adminResponse.json();
  assert.equal(adminResponse.status, 200);
  assert.equal(
    adminBody.data.users.every((u) => u.role === "admin"),
    true,
  );
});

dbTests(
  "9. passwords and password hashes are never returned in list",
  async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    for (const user of body.data.users) {
      assert.equal(user.password, undefined);
      assert.equal(user.passwordHash, undefined);
    }
  },
);

dbTests("10. pagination works for staff list", async () => {
  // Clear non-primary users and add 3 staff members
  await User.deleteMany({ _id: { $nin: [adminUser._id, staffUser._id] } });

  await createUser({ name: "Staff Member A", role: "staff" });
  await createUser({ name: "Staff Member B", role: "staff" });
  await createUser({ name: "Staff Member C", role: "staff" });

  const res1 = await fetch(`${baseUrl}/api/users?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body1 = await res1.json();

  assert.equal(res1.status, 200);
  assert.equal(body1.data.users.length, 2);
  assert.equal(body1.data.pagination.page, 1);
  assert.equal(body1.data.pagination.limit, 2);
  assert.ok(body1.data.pagination.total >= 4);
});

dbTests("11. search works across name and email", async () => {
  await createUser({
    name: "UniqueSearchTerm Jones",
    email: "jones123@example.com",
    role: "staff",
  });

  const nameRes = await fetch(`${baseUrl}/api/users?search=UniqueSearchTerm`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const nameBody = await nameRes.json();
  assert.equal(nameRes.status, 200);
  assert.equal(nameBody.data.users.length, 1);
  assert.equal(nameBody.data.users[0].name, "UniqueSearchTerm Jones");

  const emailRes = await fetch(`${baseUrl}/api/users?search=jones123`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const emailBody = await emailRes.json();
  assert.equal(emailRes.status, 200);
  assert.equal(emailBody.data.users.length, 1);
  assert.equal(emailBody.data.users[0].email, "jones123@example.com");
});

dbTests("12. status filter works for active and inactive staff", async () => {
  await createUser({
    name: "Inactive Staff 1",
    status: "inactive",
    role: "staff",
  });

  const activeRes = await fetch(`${baseUrl}/api/users?status=active`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const activeBody = await activeRes.json();
  assert.equal(activeRes.status, 200);
  assert.equal(
    activeBody.data.users.every((u) => u.status === "active"),
    true,
  );

  const inactiveRes = await fetch(`${baseUrl}/api/users?status=inactive`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const inactiveBody = await inactiveRes.json();
  assert.equal(inactiveRes.status, 200);
  assert.equal(
    inactiveBody.data.users.every((u) => u.status === "inactive"),
    true,
  );
  assert.ok(inactiveBody.data.users.length >= 1);
});

dbTests("13. sorting works for staff list", async () => {
  const ascRes = await fetch(`${baseUrl}/api/users?sortBy=name&sortOrder=asc`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ascBody = await ascRes.json();
  assert.equal(ascRes.status, 200);

  const descRes = await fetch(
    `${baseUrl}/api/users?sortBy=name&sortOrder=desc`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const descBody = await descRes.json();
  assert.equal(descRes.status, 200);
  assert.ok(ascBody.data.users.length > 0);
  assert.ok(descBody.data.users.length > 0);
});

// 3. Get single staff user tests
dbTests("14. admin can retrieve single staff user by ID", async () => {
  const staff = await createUser({ name: "Single Staff Test", role: "staff" });

  const response = await fetch(`${baseUrl}/api/users/${staff._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.user._id, staff._id.toString());
  assert.equal(body.data.user.name, "Single Staff Test");
  assert.equal(body.data.user.role, "staff");
  assert.equal(body.data.user.password, undefined);
});

dbTests("15. get single staff with invalid ID returns 400", async () => {
  const response = await fetch(`${baseUrl}/api/users/not-a-valid-id`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.errors);
});

dbTests("16. get non-existing staff returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/users/${fakeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, "User not found");
});

dbTests("17. admin can retrieve a safe admin user by ID", async () => {
  const response = await fetch(`${baseUrl}/api/users/${adminUser._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.user.role, "admin");
  assert.equal(body.data.user.password, undefined);
  assert.equal(body.data.user.passwordHash, undefined);
});

// 4. Create staff user tests
dbTests("18. admin can create staff user", async () => {
  const email = `new-staff-${Date.now()}@example.com`;
  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Created Staff",
      email,
      password: "password123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.user.name, "Created Staff");
  assert.equal(body.data.user.email, email);
  assert.equal(body.data.user.role, "staff");
  assert.equal(body.data.user.status, "active");
  assert.equal(body.data.user.password, undefined);

  // Verify password is fully hashed in database
  const record = await User.findOne({ email }).select("+password");
  assert.ok(record.password.startsWith("$2"));
  assert.notEqual(record.password, "password123");
});

dbTests(
  "19. client-supplied role admin is ignored and forced to staff on create",
  async () => {
    const email = `escalate-attempt-${Date.now()}@example.com`;
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Escalate Attempt",
        email,
        password: "password123",
        role: "admin", // attempt to create admin
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.user.role, "staff"); // strictly forced to staff
  },
);

dbTests("20. duplicate email on create returns 409", async () => {
  const email = `duplicate-user-${Date.now()}@example.com`;
  await createUser({ email, role: "staff" });

  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Duplicate Person",
      email,
      password: "password123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.message, "Email already registered");
});

dbTests("21. invalid email format on create is rejected with 400", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Invalid Email",
      email: "not-an-email",
      password: "password123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

dbTests("22. short password on create is rejected with 400", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Short Pass",
      email: "shortpass@example.com",
      password: "123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

dbTests("23. invalid/missing name on create is rejected with 400", async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "A", // too short (< 2)
      email: "validname@example.com",
      password: "password123",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

// 5. Update staff user tests
dbTests(
  "24. admin can update staff user name, email, and password",
  async () => {
    const staff = await createUser({
      name: "Old Name",
      email: `old-email-${Date.now()}@example.com`,
      password: "oldpassword",
      role: "staff",
    });

    const newEmail = `updated-email-${Date.now()}@example.com`;
    const response = await fetch(`${baseUrl}/api/users/${staff._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "New Name",
        email: newEmail,
        password: "newpassword123",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.name, "New Name");
    assert.equal(body.data.user.email, newEmail);
    assert.equal(body.data.user.password, undefined);

    // Verify new password was hashed and works with bcrypt
    const updatedRecord = await User.findById(staff._id).select("+password");
    assert.ok(updatedRecord.password.startsWith("$2"));
    const matchesNew = await bcrypt.compare(
      "newpassword123",
      updatedRecord.password,
    );
    assert.equal(matchesNew, true);
  },
);

dbTests("24a. admin can update a staff user with PATCH", async () => {
  const staff = await createUser({ role: "staff", name: "Patch Name" });

  const response = await fetch(`${baseUrl}/api/users/${staff._id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: "Patched Name", status: "inactive" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.user.name, "Patched Name");
  assert.equal(body.data.user.status, "inactive");
  assert.equal(body.data.user.password, undefined);
});

dbTests("25. update with duplicate email returns 409", async () => {
  const staffA = await createUser({
    email: `staff-a-${Date.now()}@example.com`,
    role: "staff",
  });
  const staffB = await createUser({
    email: `staff-b-${Date.now()}@example.com`,
    role: "staff",
  });

  const response = await fetch(`${baseUrl}/api/users/${staffB._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email: staffA.email }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.message, "Email already registered");
});

dbTests("26. staff role cannot be escalated to admin via update", async () => {
  const staff = await createUser({ role: "staff" });

  const response = await fetch(`${baseUrl}/api/users/${staff._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: "Updated Name", role: "admin" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.user.role, "staff"); // remains staff
});

dbTests(
  "27. admin cannot modify their own account through staff API",
  async () => {
    const response = await fetch(`${baseUrl}/api/users/${adminUser._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Admin Self Rename" }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.message, /Admins cannot modify their own account/i);
  },
);

// 6. Status tests (Activate / Deactivate)
dbTests("28. admin can deactivate and reactivate staff user", async () => {
  const staff = await createUser({ role: "staff", status: "active" });

  // Deactivate
  const deactRes = await fetch(`${baseUrl}/api/users/${staff._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "inactive" }),
  });
  const deactBody = await deactRes.json();
  assert.equal(deactRes.status, 200);
  assert.equal(deactBody.data.user.status, "inactive");

  // Reactivate
  const reactRes = await fetch(`${baseUrl}/api/users/${staff._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "active" }),
  });
  const reactBody = await reactRes.json();
  assert.equal(reactRes.status, 200);
  assert.equal(reactBody.data.user.status, "active");
});

dbTests(
  "29. invalid status value on PATCH /status is rejected with 400",
  async () => {
    const staff = await createUser({ role: "staff" });

    const response = await fetch(`${baseUrl}/api/users/${staff._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "banned" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  },
);

dbTests("30. admin cannot deactivate their own account", async () => {
  const response = await fetch(`${baseUrl}/api/users/${adminUser._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "inactive" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Admins cannot deactivate their own account/i);

  // Check admin remains active
  const check = await User.findById(adminUser._id);
  assert.equal(check.status, "active");
});

dbTests("31. deactivated staff cannot login via /api/auth/login", async () => {
  const email = `inactive-login-${Date.now()}@example.com`;
  const password = "password123";
  const staff = await createUser({
    email,
    password,
    role: "staff",
    status: "active",
  });

  // Deactivate via staff API
  await fetch(`${baseUrl}/api/users/${staff._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: "inactive" }),
  });

  // Attempt login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();

  assert.equal(loginRes.status, 403);
  assert.equal(loginBody.message, "Account is inactive");
});

// 7. Delete tests
dbTests("32. admin can delete staff user", async () => {
  const staff = await createUser({ role: "staff" });

  const response = await fetch(`${baseUrl}/api/users/${staff._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.message, /deleted successfully/i);

  // Verify user is gone
  const check = await User.findById(staff._id);
  assert.equal(check, null);
});

dbTests("33. admin cannot delete their own account", async () => {
  const response = await fetch(`${baseUrl}/api/users/${adminUser._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /Admins cannot delete their own account/i);

  const check = await User.findById(adminUser._id);
  assert.ok(check);
});

dbTests("34. admin accounts cannot be deleted through staff API", async () => {
  const secondAdmin = await createUser({ role: "admin" });

  const response = await fetch(`${baseUrl}/api/users/${secondAdmin._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.match(
    body.message,
    /Admin accounts cannot be deleted through staff API/i,
  );

  const check = await User.findById(secondAdmin._id);
  assert.ok(check);
});

dbTests("35. deleting non-existing user returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const response = await fetch(`${baseUrl}/api/users/${fakeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
});
