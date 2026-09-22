import mongoose from "mongoose";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      minlength: [2, "Customer name must be at least 2 characters"],
      maxlength: [100, "Customer name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Customer email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, "Please provide a valid customer email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [255, "Address cannot exceed 255 characters"],
    },
    status: {
      type: String,
      required: [true, "Customer status is required"],
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

customerSchema.index({ name: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
