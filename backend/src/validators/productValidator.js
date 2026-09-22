const objectIdRegex = /^[0-9a-fA-F]{24}$/;
import { isSingleString } from "./validationHelpers.js";
const ALLOWED_SORT_FIELDS = [
  "name",
  "category",
  "price",
  "stock",
  "status",
  "createdAt",
  "updatedAt",
];
const ALLOWED_STATUSES = ["active", "inactive", "out_of_stock"];

const buildValidationError = (errors) => ({
  success: false,
  message: "Validation failed",
  errors,
});

export const validateProductId = (request, response, next) => {
  const { id } = request.params;

  if (!id || typeof id !== "string" || !objectIdRegex.test(id)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "id",
          message: "Invalid product ID format",
        },
      ]),
    );
  }

  next();
};

export const validateListProductsQuery = (request, response, next) => {
  const { page, limit, status, sortBy, sortOrder } = request.query;
  const errors = [];

  if (page !== undefined) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      errors.push({
        field: "page",
        message: "Page must be a positive integer",
      });
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push({
        field: "limit",
        message: "Limit must be an integer between 1 and 100",
      });
    }
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push({
      field: "status",
      message: "Status must be active, inactive, or out_of_stock",
    });
  }

  if (sortBy !== undefined && !ALLOWED_SORT_FIELDS.includes(sortBy)) {
    errors.push({
      field: "sortBy",
      message: `Sort field must be one of: ${ALLOWED_SORT_FIELDS.join(", ")}`,
    });
  }

  if (
    sortOrder !== undefined &&
    (!isSingleString(sortOrder) ||
      !["asc", "desc"].includes(sortOrder.toLowerCase()))
  ) {
    errors.push({
      field: "sortOrder",
      message: "Sort order must be either asc or desc",
    });
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};

export const validateCreateProductInput = (request, response, next) => {
  const { name, description, category, price, stock, status } =
    request.body || {};
  const errors = [];

  // name
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Product name must be at least 2 characters",
    });
  } else if (name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Product name cannot exceed 100 characters",
    });
  }

  // description (optional)
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      errors.push({
        field: "description",
        message: "Description must be a string",
      });
    } else if (description.trim().length > 1000) {
      errors.push({
        field: "description",
        message: "Description cannot exceed 1000 characters",
      });
    }
  }

  // category
  if (
    !category ||
    typeof category !== "string" ||
    category.trim().length === 0
  ) {
    errors.push({
      field: "category",
      message: "Category is required",
    });
  } else if (category.trim().length > 50) {
    errors.push({
      field: "category",
      message: "Category cannot exceed 50 characters",
    });
  }

  // price
  if (
    price === undefined ||
    price === null ||
    typeof price !== "number" ||
    isNaN(price)
  ) {
    errors.push({
      field: "price",
      message: "Price is required and must be a valid number",
    });
  } else if (price < 0) {
    errors.push({
      field: "price",
      message: "Price cannot be negative",
    });
  }

  // stock
  if (
    stock === undefined ||
    stock === null ||
    typeof stock !== "number" ||
    isNaN(stock)
  ) {
    errors.push({
      field: "stock",
      message: "Stock is required and must be an integer",
    });
  } else if (!Number.isInteger(stock)) {
    errors.push({
      field: "stock",
      message: "Stock must be an integer",
    });
  } else if (stock < 0) {
    errors.push({
      field: "stock",
      message: "Stock cannot be negative",
    });
  }

  // status (optional)
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push({
      field: "status",
      message: "Status must be active, inactive, or out_of_stock",
    });
  }

  // Stock vs status inconsistency
  if (typeof stock === "number" && Number.isInteger(stock)) {
    if (stock > 0 && status === "out_of_stock") {
      errors.push({
        field: "status",
        message:
          "Product with stock greater than 0 cannot have status out_of_stock",
      });
    }
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};

export const validateUpdateProductInput = (request, response, next) => {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "body",
          message: "Request body must be an object",
        },
      ]),
    );
  }

  const updateFields = [
    "name",
    "description",
    "category",
    "price",
    "stock",
    "status",
  ];
  const providedFields = Object.keys(body).filter((key) =>
    updateFields.includes(key),
  );

  if (providedFields.length === 0) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "body",
          message: "At least one valid field must be provided for update",
        },
      ]),
    );
  }

  const errors = [];
  const { name, description, category, price, stock, status } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      errors.push({
        field: "name",
        message: "Product name must be at least 2 characters",
      });
    } else if (name.trim().length > 100) {
      errors.push({
        field: "name",
        message: "Product name cannot exceed 100 characters",
      });
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      errors.push({
        field: "description",
        message: "Description must be a string",
      });
    } else if (description.trim().length > 1000) {
      errors.push({
        field: "description",
        message: "Description cannot exceed 1000 characters",
      });
    }
  }

  if (category !== undefined) {
    if (typeof category !== "string" || category.trim().length === 0) {
      errors.push({
        field: "category",
        message: "Category cannot be empty",
      });
    } else if (category.trim().length > 50) {
      errors.push({
        field: "category",
        message: "Category cannot exceed 50 characters",
      });
    }
  }

  if (price !== undefined) {
    if (typeof price !== "number" || isNaN(price)) {
      errors.push({
        field: "price",
        message: "Price must be a valid number",
      });
    } else if (price < 0) {
      errors.push({
        field: "price",
        message: "Price cannot be negative",
      });
    }
  }

  if (stock !== undefined) {
    if (typeof stock !== "number" || isNaN(stock)) {
      errors.push({
        field: "stock",
        message: "Stock must be an integer",
      });
    } else if (!Number.isInteger(stock)) {
      errors.push({
        field: "stock",
        message: "Stock must be an integer",
      });
    } else if (stock < 0) {
      errors.push({
        field: "stock",
        message: "Stock cannot be negative",
      });
    }
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push({
      field: "status",
      message: "Status must be active, inactive, or out_of_stock",
    });
  }

  if (
    stock !== undefined &&
    typeof stock === "number" &&
    Number.isInteger(stock) &&
    status !== undefined
  ) {
    if (stock > 0 && status === "out_of_stock") {
      errors.push({
        field: "status",
        message:
          "Product with stock greater than 0 cannot have status out_of_stock",
      });
    }
    if (stock === 0 && status === "active") {
      errors.push({
        field: "status",
        message: "Cannot set status to active when stock is 0",
      });
    }
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};
