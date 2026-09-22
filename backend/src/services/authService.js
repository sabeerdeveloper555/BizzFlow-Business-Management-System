import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import AppError from "../utils/AppError.js";

const getSafeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : { ...user };
  const { _id, id: legacyId, name, email, role, status } = userObject;

  return {
    id: _id ? _id.toString() : legacyId,
    name,
    email,
    role,
    status,
  };
};

export const registerUser = async (userData) => {
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

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new AppError(403, "Account is inactive");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = generateToken({
    userId: user._id,
    role: user.role,
  });

  return {
    token,
    user: getSafeUser(user),
  };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new AppError(401, "User not found");
  }

  if (user.status !== "active") {
    throw new AppError(403, "Account is inactive");
  }

  return getSafeUser(user);
};
