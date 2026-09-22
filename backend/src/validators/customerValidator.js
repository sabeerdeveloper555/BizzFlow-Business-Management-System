const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { isSingleString } from "./validationHelpers.js";
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const ALLOWED_SORT_FIELDS = [
  "name",
  "email",
  "phone",
  "company",
  "status",
  "createdAt",
  "updatedAt",
];
const ALLOWED_STATUSES = ["active", "inactive"];

const buildValidationError = (errors) => ({
  success: false,
  message: "Validation failed",
  errors,
});

export const validateCustomerId = (request, response, next) => {
  const { id } = request.params;

  if (!id || typeof id !== "string" || !objectIdRegex.test(id)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "id",
          message: "Invalid customer ID format",
        },
      ]),
    );
  }

  next();
};

export const validateListCustomersQuery = (request, response, next) => {
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
      message: "Status must be either active or inactive",
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

export const validateCreateCustomerInput = (request, response, next) => {
  const { name, email, phone, company, address, status } = request.body || {};
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Customer name must be at least 2 characters",
    });
  } else if (name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Customer name cannot exceed 100 characters",
    });
  }

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push({
      field: "email",
      message: "Please provide a valid customer email address",
    });
  }

  if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
    errors.push({
      field: "phone",
      message: "Phone number is required",
    });
  } else if (phone.trim().length > 20) {
    errors.push({
      field: "phone",
      message: "Phone number cannot exceed 20 characters",
    });
  }

  if (company !== undefined && company !== null) {
    if (typeof company !== "string") {
      errors.push({
        field: "company",
        message: "Company name must be a string",
      });
    } else if (company.trim().length > 100) {
      errors.push({
        field: "company",
        message: "Company name cannot exceed 100 characters",
      });
    }
  }

  if (address !== undefined && address !== null) {
    if (typeof address !== "string") {
      errors.push({
        field: "address",
        message: "Address must be a string",
      });
    } else if (address.trim().length > 255) {
      errors.push({
        field: "address",
        message: "Address cannot exceed 255 characters",
      });
    }
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push({
      field: "status",
      message: "Status must be either active or inactive",
    });
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};

export const validateUpdateCustomerInput = (request, response, next) => {
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
    "email",
    "phone",
    "company",
    "address",
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
  const { name, email, phone, company, address, status } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      errors.push({
        field: "name",
        message: "Customer name must be at least 2 characters",
      });
    } else if (name.trim().length > 100) {
      errors.push({
        field: "name",
        message: "Customer name cannot exceed 100 characters",
      });
    }
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !emailRegex.test(email.trim())) {
      errors.push({
        field: "email",
        message: "Please provide a valid customer email address",
      });
    }
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || phone.trim().length === 0) {
      errors.push({
        field: "phone",
        message: "Phone number is required",
      });
    } else if (phone.trim().length > 20) {
      errors.push({
        field: "phone",
        message: "Phone number cannot exceed 20 characters",
      });
    }
  }

  if (company !== undefined && company !== null) {
    if (typeof company !== "string") {
      errors.push({
        field: "company",
        message: "Company name must be a string",
      });
    } else if (company.trim().length > 100) {
      errors.push({
        field: "company",
        message: "Company name cannot exceed 100 characters",
      });
    }
  }

  if (address !== undefined && address !== null) {
    if (typeof address !== "string") {
      errors.push({
        field: "address",
        message: "Address must be a string",
      });
    } else if (address.trim().length > 255) {
      errors.push({
        field: "address",
        message: "Address cannot exceed 255 characters",
      });
    }
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push({
      field: "status",
      message: "Status must be either active or inactive",
    });
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};
