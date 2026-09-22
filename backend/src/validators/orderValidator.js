const objectIdRegex = /^[0-9a-fA-F]{24}$/;
import { isSingleString } from "./validationHelpers.js";
const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "totalAmount", "status"];
const ALLOWED_STATUSES = ["pending", "processing", "completed", "cancelled"];

const buildValidationError = (errors) => ({
  success: false,
  message: "Validation failed",
  errors,
});

export const validateOrderId = (request, response, next) => {
  const { id } = request.params;

  if (!id || typeof id !== "string" || !objectIdRegex.test(id)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "id",
          message: "Invalid order ID format",
        },
      ]),
    );
  }

  next();
};

export const validateListOrdersQuery = (request, response, next) => {
  const { page, limit, status, customer, sortBy, sortOrder } = request.query;
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
      message: "Status must be pending, processing, completed, or cancelled",
    });
  }

  if (customer !== undefined) {
    if (typeof customer !== "string" || !objectIdRegex.test(customer.trim())) {
      errors.push({
        field: "customer",
        message: "Invalid customer ID format in query",
      });
    }
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

export const validateCreateOrderInput = (request, response, next) => {
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

  const { customer, items } = body;
  const errors = [];

  // Validate customer
  if (
    !customer ||
    typeof customer !== "string" ||
    !objectIdRegex.test(customer)
  ) {
    errors.push({
      field: "customer",
      message: "Valid customer ID is required",
    });
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push({
      field: "items",
      message: "Order must contain at least one item",
    });
  } else {
    const productIds = [];

    items.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push({
          field: `items[${index}]`,
          message: "Each order item must be an object",
        });
        return;
      }

      const { product, quantity } = item;

      // Validate product ID
      if (
        !product ||
        typeof product !== "string" ||
        !objectIdRegex.test(product)
      ) {
        errors.push({
          field: `items[${index}].product`,
          message: "Valid product ID is required",
        });
      } else {
        productIds.push(product);
      }

      // Validate quantity
      if (
        quantity === undefined ||
        quantity === null ||
        typeof quantity !== "number" ||
        isNaN(quantity)
      ) {
        errors.push({
          field: `items[${index}].quantity`,
          message: "Quantity is required and must be an integer",
        });
      } else if (!Number.isInteger(quantity)) {
        errors.push({
          field: `items[${index}].quantity`,
          message: "Quantity must be an integer",
        });
      } else if (quantity < 1) {
        errors.push({
          field: `items[${index}].quantity`,
          message: "Quantity must be at least 1",
        });
      }
    });

    // Check duplicate products
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      errors.push({
        field: "items",
        message: "Duplicate products are not allowed in the same order",
      });
    }
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};

export const validateUpdateOrderInput = (request, response, next) => {
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

  const keys = Object.keys(body);
  const disallowedKeys = keys.filter((k) => k !== "status");

  if (disallowedKeys.length > 0) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "body",
          message: "Only order status can be updated",
        },
      ]),
    );
  }

  const { status } = body;

  if (!status || typeof status !== "string") {
    return response.status(400).json(
      buildValidationError([
        {
          field: "status",
          message: "Status is required",
        },
      ]),
    );
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "status",
          message:
            "Status must be pending, processing, completed, or cancelled",
        },
      ]),
    );
  }

  next();
};
