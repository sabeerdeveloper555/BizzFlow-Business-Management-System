const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { isSingleString } from "./validationHelpers.js";
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const ALLOWED_SORT_FIELDS = [
  "name",
  "email",
  "role",
  "status",
  "createdAt",
  "updatedAt",
];
const ALLOWED_STATUSES = ["active", "inactive"];
const ALLOWED_ROLES = ["admin", "staff"];

const buildValidationError = (errors) => ({
  success: false,
  message: "Validation failed",
  errors,
});

export const validateUserId = (request, response, next) => {
  const { id } = request.params;

  if (!id || typeof id !== "string" || !objectIdRegex.test(id)) {
    return response.status(400).json(
      buildValidationError([
        {
          field: "id",
          message: "Invalid user ID format",
        },
      ]),
    );
  }

  next();
};

export const validateListUsersQuery = (request, response, next) => {
  const { page, limit, role, status, sortBy, sortOrder, search } =
    request.query;
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

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    errors.push({
      field: "role",
      message: "Role must be either admin or staff",
    });
  }

  if (search !== undefined && !isSingleString(search)) {
    errors.push({
      field: "search",
      message: "Search must be a string",
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

export const validateCreateUserInput = (request, response, next) => {
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

  const { name, email, password } = body;
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters",
    });
  } else if (name.trim().length > 50) {
    errors.push({
      field: "name",
      message: "Name cannot exceed 50 characters",
    });
  }

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push({
      field: "email",
      message: "Please provide a valid email address",
    });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push({
      field: "password",
      message: "Password must be at least 6 characters",
    });
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};

export const validateUpdateUserInput = (request, response, next) => {
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

  const allowedFields = ["name", "email", "password", "status"];
  const providedFields = Object.keys(body).filter((key) =>
    allowedFields.includes(key),
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
  const { name, email, password, status } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      errors.push({
        field: "name",
        message: "Name must be at least 2 characters",
      });
    } else if (name.trim().length > 50) {
      errors.push({
        field: "name",
        message: "Name cannot exceed 50 characters",
      });
    }
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !emailRegex.test(email.trim())) {
      errors.push({
        field: "email",
        message: "Please provide a valid email address",
      });
    }
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      errors.push({
        field: "password",
        message: "Password must be at least 6 characters",
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

export const validateUpdateStatusInput = (request, response, next) => {
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
          message: "Status must be either active or inactive",
        },
      ]),
    );
  }

  next();
};
