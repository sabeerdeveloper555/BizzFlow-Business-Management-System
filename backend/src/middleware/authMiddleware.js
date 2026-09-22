import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

const authMiddleware = async (request, response, next) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      !decoded ||
      typeof decoded.userId !== "string" ||
      !mongoose.isValidObjectId(decoded.userId)
    ) {
      throw new AppError(401, "Invalid or expired token");
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      throw new AppError(401, "User not found");
    }

    if (user.status !== "active") {
      throw new AppError(403, "Account is inactive");
    }

    request.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return response.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    if (error instanceof AppError) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export default authMiddleware;
