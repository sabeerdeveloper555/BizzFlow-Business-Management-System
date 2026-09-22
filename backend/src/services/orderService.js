import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";

const escapeRegex = (string) =>
  string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listOrders = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(queryParams.limit, 10) || 10),
  );
  const { status, customer, search } = queryParams;
  const sortBy = queryParams.sortBy || "createdAt";
  const sortDirection =
    (queryParams.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (customer) {
    filter.customer = customer;
  }

  if (search && typeof search === "string" && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, "i");
    const matchingCustomers = await Customer.find({
      $or: [{ name: searchRegex }, { email: searchRegex }],
    }).select("_id");

    const customerIds = matchingCustomers.map((c) => c._id);
    if (filter.customer) {
      const isMatch = customerIds.some(
        (cId) => cId.toString() === filter.customer.toString(),
      );
      if (!isMatch) {
        filter.customer = null;
      }
    } else {
      filter.customer = { $in: customerIds };
    }
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name email phone company")
      .populate("items.product", "name category")
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .select("-__v"),
    Order.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getOrderById = async (id) => {
  const order = await Order.findById(id)
    .populate("customer", "name email phone company address status")
    .populate("items.product", "name category")
    .select("-__v");

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  return order;
};

export const createOrder = async (orderData) => {
  const { customer: customerId, items } = orderData;

  // 1. Validate customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }
  if (customer.status !== "active") {
    throw new AppError(400, "Customer account is inactive");
  }

  // 2. Validate all products and stock upfront
  const productIds = items.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = new Map();
  products.forEach((p) => productMap.set(p._id.toString(), p));

  const validatedItems = [];
  let calculatedTotal = 0;

  for (const item of items) {
    const product = productMap.get(item.product.toString());
    if (!product) {
      throw new AppError(404, `Product not found: ${item.product}`);
    }
    if (product.status === "inactive") {
      throw new AppError(400, `Product "${product.name}" is inactive`);
    }
    if (product.status === "out_of_stock" || product.stock <= 0) {
      throw new AppError(400, `Product "${product.name}" is out of stock`);
    }
    if (product.stock < item.quantity) {
      throw new AppError(
        400,
        `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
      );
    }

    const priceSnapshot = product.price;
    validatedItems.push({
      product: product._id,
      quantity: item.quantity,
      price: priceSnapshot,
    });
    calculatedTotal += priceSnapshot * item.quantity;
  }

  calculatedTotal = Math.round(calculatedTotal * 100) / 100;

  // 3. Atomically deduct stock and create order
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (_err) {
    session = null;
    useTransaction = false;
  }

  if (useTransaction && session) {
    try {
      for (const item of validatedItems) {
        const product = productMap.get(item.product.toString());
        const newStock = product.stock - item.quantity;
        const newStatus = newStock === 0 ? "out_of_stock" : product.status;

        await Product.findByIdAndUpdate(
          item.product,
          { stock: newStock, status: newStatus },
          { session, runValidators: true },
        );
      }

      const [newOrder] = await Order.create(
        [
          {
            customer: customer._id,
            items: validatedItems,
            totalAmount: calculatedTotal,
            status: "pending",
          },
        ],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      const orderObj = newOrder.toObject();
      delete orderObj.__v;
      return orderObj;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } else {
    // Non-transactional fallback with manual rollback
    const stockDeductionsApplied = [];
    try {
      for (const item of validatedItems) {
        const product = productMap.get(item.product.toString());
        const newStock = product.stock - item.quantity;
        const newStatus = newStock === 0 ? "out_of_stock" : product.status;

        await Product.findByIdAndUpdate(
          item.product,
          { stock: newStock, status: newStatus },
          { runValidators: true },
        );

        stockDeductionsApplied.push({
          productId: item.product,
          restoreStock: product.stock,
          restoreStatus: product.status,
        });
      }

      const newOrder = await Order.create({
        customer: customer._id,
        items: validatedItems,
        totalAmount: calculatedTotal,
        status: "pending",
      });

      const orderObj = newOrder.toObject();
      delete orderObj.__v;
      return orderObj;
    } catch (error) {
      for (const rollback of stockDeductionsApplied) {
        await Product.findByIdAndUpdate(rollback.productId, {
          stock: rollback.restoreStock,
          status: rollback.restoreStatus,
        });
      }
      throw error;
    }
  }
};

export const updateOrderStatus = async (id, newStatus) => {
  const order = await Order.findById(id);
  if (!order) {
    throw new AppError(404, "Order not found");
  }

  const currentStatus = order.status;

  if (currentStatus === newStatus) {
    const orderObj = order.toObject();
    delete orderObj.__v;
    return orderObj;
  }

  const validTransitions = {
    pending: ["processing", "cancelled"],
    processing: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      400,
      `Cannot transition order status from "${currentStatus}" to "${newStatus}"`,
    );
  }

  // If cancelling order: restore stock
  if (newStatus === "cancelled") {
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (_err) {
      session = null;
      useTransaction = false;
    }

    if (useTransaction && session) {
      try {
        for (const item of order.items) {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            const updatedStock = product.stock + item.quantity;
            const updatedStatus =
              product.status === "out_of_stock" && updatedStock > 0
                ? "active"
                : product.status;

            await Product.findByIdAndUpdate(
              item.product,
              { stock: updatedStock, status: updatedStatus },
              { session },
            );
          }
        }

        order.status = "cancelled";
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        const orderObj = order.toObject();
        delete orderObj.__v;
        return orderObj;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } else {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          const updatedStock = product.stock + item.quantity;
          const updatedStatus =
            product.status === "out_of_stock" && updatedStock > 0
              ? "active"
              : product.status;

          await Product.findByIdAndUpdate(item.product, {
            stock: updatedStock,
            status: updatedStatus,
          });
        }
      }

      order.status = "cancelled";
      await order.save();

      const orderObj = order.toObject();
      delete orderObj.__v;
      return orderObj;
    }
  }

  order.status = newStatus;
  await order.save();

  const orderObj = order.toObject();
  delete orderObj.__v;
  return orderObj;
};

export const deleteOrder = async (id) => {
  const order = await Order.findById(id);
  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (order.status === "completed") {
    throw new AppError(400, "Completed orders cannot be deleted");
  }

  if (order.status === "pending" || order.status === "processing") {
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (_err) {
      session = null;
      useTransaction = false;
    }

    if (useTransaction && session) {
      try {
        for (const item of order.items) {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            const updatedStock = product.stock + item.quantity;
            const updatedStatus =
              product.status === "out_of_stock" && updatedStock > 0
                ? "active"
                : product.status;

            await Product.findByIdAndUpdate(
              item.product,
              { stock: updatedStock, status: updatedStatus },
              { session },
            );
          }
        }

        await Order.findByIdAndDelete(id, { session });

        await session.commitTransaction();
        session.endSession();
        return true;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } else {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          const updatedStock = product.stock + item.quantity;
          const updatedStatus =
            product.status === "out_of_stock" && updatedStock > 0
              ? "active"
              : product.status;

          await Product.findByIdAndUpdate(item.product, {
            stock: updatedStock,
            status: updatedStatus,
          });
        }
      }

      await Order.findByIdAndDelete(id);
      return true;
    }
  }

  // If order was already cancelled, stock was already restored
  await Order.findByIdAndDelete(id);
  return true;
};
