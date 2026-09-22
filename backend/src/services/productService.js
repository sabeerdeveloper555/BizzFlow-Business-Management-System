import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";

const escapeRegex = (string) =>
  string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listProducts = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(queryParams.limit, 10) || 10),
  );
  const { search, category, status } = queryParams;
  const sortBy = queryParams.sortBy || "createdAt";
  const sortDirection =
    (queryParams.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (category && typeof category === "string" && category.trim()) {
    filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, "i");
  }

  if (search && typeof search === "string" && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, "i");
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .select("-__v"),
    Product.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getProductById = async (id) => {
  const product = await Product.findById(id).select("-__v");

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  return product;
};

export const createProduct = async (productData) => {
  const { name, description, category, price, stock, status } = productData;

  let finalStatus;
  if (stock === 0) {
    finalStatus = "out_of_stock";
  } else {
    finalStatus = status || "active";
  }

  const newProduct = await Product.create({
    name: name.trim(),
    description:
      description && typeof description === "string"
        ? description.trim()
        : undefined,
    category: category.trim(),
    price,
    stock,
    status: finalStatus,
  });

  const productObject = newProduct.toObject();
  delete productObject.__v;
  return productObject;
};

export const updateProduct = async (id, updateData) => {
  const product = await Product.findById(id);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  const targetStock =
    updateData.stock !== undefined ? updateData.stock : product.stock;

  if (updateData.status !== undefined) {
    if (targetStock === 0 && updateData.status === "active") {
      throw new AppError(400, "Cannot set status to active when stock is 0");
    }
    if (targetStock > 0 && updateData.status === "out_of_stock") {
      throw new AppError(
        400,
        "Product with stock greater than 0 cannot have status out_of_stock",
      );
    }
    product.status = updateData.status;
  } else if (updateData.stock !== undefined) {
    if (updateData.stock === 0) {
      product.status = "out_of_stock";
    } else if (updateData.stock > 0 && product.status === "out_of_stock") {
      product.status = "active";
    }
    // If product.status was "inactive", it remains "inactive" when stock > 0
  }

  if (updateData.name !== undefined) {
    product.name = updateData.name.trim();
  }
  if (updateData.description !== undefined) {
    product.description =
      updateData.description && typeof updateData.description === "string"
        ? updateData.description.trim()
        : "";
  }
  if (updateData.category !== undefined) {
    product.category = updateData.category.trim();
  }
  if (updateData.price !== undefined) {
    product.price = updateData.price;
  }
  if (updateData.stock !== undefined) {
    product.stock = updateData.stock;
  }

  await product.save();

  const productObject = product.toObject();
  delete productObject.__v;
  return productObject;
};

export const deleteProduct = async (id) => {
  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  return true;
};
