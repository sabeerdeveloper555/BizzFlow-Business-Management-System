import bcrypt from "bcryptjs";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSafeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : { ...user };
  delete userObject.password;
  delete userObject.passwordHash;
  delete userObject.__v;
  return userObject;
};

export const listUsers = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(queryParams.limit, 10) || 10),
  );
  const { search, role, status } = queryParams;
  const sortBy = queryParams.sortBy || "createdAt";
  const sortDirection =
    (queryParams.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (status) {
    filter.status = status;
  }

  if (search && typeof search === "string" && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, "i");
    filter.$or = [{ name: searchRegex }, { email: searchRegex }];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .select("-password -__v"),
    User.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    users: users.map(getSafeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getUserById = async (id) => {
  const user = await User.findById(id).select("-password -__v");

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return getSafeUser(user);
};

export const createStaff = async (userData) => {
  const { name, email, password } = userData;
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError(409, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: "staff",
    status: "active",
  });

  return getSafeUser(newUser);
};

export const updateStaff = async (id, updateData, currentAdminId) => {
  const user = await User.findById(id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user._id.toString() === currentAdminId.toString()) {
    if (updateData.status === "inactive") {
      throw new AppError(400, "Admins cannot deactivate their own account");
    }
    throw new AppError(
      403,
      "Admins cannot modify their own account through staff API",
    );
  }

  if (user.role === "admin") {
    throw new AppError(
      403,
      "Admin accounts cannot be modified through staff API",
    );
  }

  if (updateData.email !== undefined) {
    const normalizedEmail = updateData.email.trim().toLowerCase();
    if (normalizedEmail !== user.email) {
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });
      if (existingUser) {
        throw new AppError(409, "Email already registered");
      }
      user.email = normalizedEmail;
    }
  }

  if (updateData.name !== undefined) {
    user.name = updateData.name.trim();
  }

  if (updateData.password !== undefined) {
    user.password = await bcrypt.hash(updateData.password, 10);
  }

  if (updateData.status !== undefined) {
    user.status = updateData.status;
  }

  user.role = "staff";

  await user.save();

  return getSafeUser(user);
};

export const updateStaffStatus = async (id, newStatus, currentAdminId) => {
  const user = await User.findById(id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user._id.toString() === currentAdminId.toString()) {
    if (newStatus === "inactive") {
      throw new AppError(400, "Admins cannot deactivate their own account");
    }
    throw new AppError(
      400,
      "Admins cannot modify their own account through staff API",
    );
  }

  if (user.role === "admin") {
    throw new AppError(
      403,
      "Admin accounts cannot be modified through staff API",
    );
  }

  user.status = newStatus;
  await user.save();

  return getSafeUser(user);
};

export const deleteStaff = async (id, currentAdminId) => {
  const user = await User.findById(id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user._id.toString() === currentAdminId.toString()) {
    throw new AppError(400, "Admins cannot delete their own account");
  }

  if (user.role === "admin") {
    throw new AppError(
      403,
      "Admin accounts cannot be deleted through staff API",
    );
  }

  await User.findByIdAndDelete(id);

  return true;
};

export const listStaff = listUsers;
export const getStaffById = getUserById;
