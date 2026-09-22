import mongoose from "mongoose";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: {
        values: ["admin", "staff"],
        message: "Role must be either admin or staff",
      },
      default: "staff",
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["active", "inactive"],
        message: "Status must be either active or inactive",
      },
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ role: 1, status: 1 });

const User = mongoose.model("User", userSchema);

export default User;
