const buildValidationError = (errors) => ({
  success: false,
  message: "Validation failed",
  errors,
});

export const validateRegisterInput = (request, response, next) => {
  const { name, email, password } = request.body || {};
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters",
    });
  } else if (name.trim().length > 50) {
    errors.push({ field: "name", message: "Name cannot exceed 50 characters" });
  }

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
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

export const validateLoginInput = (request, response, next) => {
  const { email, password } = request.body || {};
  const errors = [];

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    errors.push({
      field: "email",
      message: "Please provide a valid email address",
    });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push({ field: "password", message: "Password is required" });
  }

  if (errors.length > 0) {
    return response.status(400).json(buildValidationError(errors));
  }

  next();
};
