import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const RECENT_ORDER_LIMIT = 5;
const TOP_PRODUCT_LIMIT = 5;
const LOW_STOCK_THRESHOLD = 5;
const SALES_MONTH_COUNT = 12;
const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getSalesStartDate = () => {
  const startDate = new Date();
  startDate.setUTCDate(1);
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCMonth(startDate.getUTCMonth() - (SALES_MONTH_COUNT - 1));
  return startDate;
};

const getSummary = async () => {
  const [
    totalCustomers,
    totalProducts,
    totalOrders,
    totalStaff,
    revenueResult,
  ] = await Promise.all([
    Customer.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    User.countDocuments({ role: "staff" }),
    Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  return {
    totalCustomers,
    totalProducts,
    totalOrders,
    totalStaff,
    totalRevenue: revenueResult[0]?.total || 0,
  };
};

const getInventoryStatistics = async () => {
  const [
    activeProducts,
    inactiveProducts,
    lowStockProducts,
    outOfStockProducts,
  ] = await Promise.all([
    Product.countDocuments({ status: "active" }),
    Product.countDocuments({ status: "inactive" }),
    Product.countDocuments({
      status: "active",
      stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
    }),
    Product.countDocuments({ status: "out_of_stock" }),
  ]);

  return {
    activeProducts,
    inactiveProducts,
    lowStockProducts,
    outOfStockProducts,
  };
};

const getCustomerStatistics = async () => {
  const [activeCustomers, inactiveCustomers] = await Promise.all([
    Customer.countDocuments({ status: "active" }),
    Customer.countDocuments({ status: "inactive" }),
  ]);

  return { activeCustomers, inactiveCustomers };
};

const getSalesOverview = async () => {
  const sales = await Order.aggregate([
    {
      $match: {
        status: "completed",
        createdAt: { $gte: getSalesStartDate() },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  return sales.map((entry) => ({
    month: `${MONTH_NAMES[entry._id.month - 1]} ${entry._id.year}`,
    revenue: entry.revenue,
    orders: entry.orders,
  }));
};

const getRecentOrders = async () => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(RECENT_ORDER_LIMIT)
    .populate("customer", "name email")
    .select("customer totalAmount status createdAt")
    .lean();

  return orders.map((order) => ({
    _id: order._id,
    customer: order.customer || null,
    total: order.totalAmount,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
  }));
};

const getTopProducts = async () =>
  Order.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        quantitySold: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
      },
    },
    {
      $lookup: {
        from: Product.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: {
          $ifNull: [{ $arrayElemAt: ["$product.name", 0] }, "Unknown Product"],
        },
        quantitySold: 1,
        revenue: 1,
      },
    },
    { $sort: { quantitySold: -1, revenue: -1 } },
    { $limit: TOP_PRODUCT_LIMIT },
  ]);

const getOrderStatus = async () => {
  const statusCounts = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return statusCounts.reduce(
    (counts, entry) => {
      if (Object.prototype.hasOwnProperty.call(counts, entry._id)) {
        counts[entry._id] = entry.count;
      }
      return counts;
    },
    Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])),
  );
};

const getLowStockProducts = () =>
  Product.find({ status: "active", stock: { $lte: LOW_STOCK_THRESHOLD } })
    .sort({ stock: 1, name: 1 })
    .limit(TOP_PRODUCT_LIMIT)
    .select("name stock status")
    .lean();

export const getDashboard = async () => {
  const [
    summary,
    inventoryStatistics,
    customerStatistics,
    salesOverview,
    recentOrders,
    topProducts,
    orderStatus,
    lowStockProducts,
  ] = await Promise.all([
    getSummary(),
    getInventoryStatistics(),
    getCustomerStatistics(),
    getSalesOverview(),
    getRecentOrders(),
    getTopProducts(),
    getOrderStatus(),
    getLowStockProducts(),
  ]);

  return {
    summary,
    orderStatistics: orderStatus,
    inventoryStatistics,
    customerStatistics,
    salesOverview,
    recentOrders,
    topProducts,
    orderStatus,
    lowStockProducts,
  };
};
