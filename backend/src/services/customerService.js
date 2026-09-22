import Customer from "../models/Customer.js";
import AppError from "../utils/AppError.js";

const escapeRegex = (string) =>
  string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listCustomers = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(queryParams.limit, 10) || 10),
  );
  const { search, status } = queryParams;
  const sortBy = queryParams.sortBy || "createdAt";
  const sortDirection =
    (queryParams.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (search && typeof search === "string" && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, "i");
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { company: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .select("-__v"),
    Customer.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getCustomerById = async (id) => {
  const customer = await Customer.findById(id).select("-__v");

  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  return customer;
};

export const createCustomer = async (customerData) => {
  const { name, email, phone, company, address, status } = customerData;
  const normalizedEmail = email.trim().toLowerCase();

  const existingCustomer = await Customer.findOne({ email: normalizedEmail });
  if (existingCustomer) {
    throw new AppError(409, "Email already registered");
  }

  const newCustomer = await Customer.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    company:
      company && typeof company === "string" ? company.trim() : undefined,
    address:
      address && typeof address === "string" ? address.trim() : undefined,
    status: status || "active",
  });

  const customerObject = newCustomer.toObject();
  delete customerObject.__v;
  return customerObject;
};

export const updateCustomer = async (id, updateData) => {
  const customer = await Customer.findById(id);

  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  if (updateData.email !== undefined) {
    const normalizedEmail = updateData.email.trim().toLowerCase();
    if (normalizedEmail !== customer.email) {
      const existingCustomer = await Customer.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });
      if (existingCustomer) {
        throw new AppError(409, "Email already registered");
      }
      customer.email = normalizedEmail;
    }
  }

  if (updateData.name !== undefined) {
    customer.name = updateData.name.trim();
  }
  if (updateData.phone !== undefined) {
    customer.phone = updateData.phone.trim();
  }
  if (updateData.company !== undefined) {
    customer.company =
      updateData.company && typeof updateData.company === "string"
        ? updateData.company.trim()
        : "";
  }
  if (updateData.address !== undefined) {
    customer.address =
      updateData.address && typeof updateData.address === "string"
        ? updateData.address.trim()
        : "";
  }
  if (updateData.status !== undefined) {
    customer.status = updateData.status;
  }

  await customer.save();

  const customerObject = customer.toObject();
  delete customerObject.__v;
  return customerObject;
};

export const deleteCustomer = async (id) => {
  const customer = await Customer.findByIdAndDelete(id);

  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  return true;
};
