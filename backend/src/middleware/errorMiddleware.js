const errorMiddleware = (error, _request, response, _next) => {
  const statusCode = error.statusCode || 500;

  if (error?.name === "ValidationError") {
    const details = Object.values(error.errors || {}).map(
      (validationError) => ({
        field: validationError.path,
        message: validationError.message,
      }),
    );

    return response.status(400).json({
      success: false,
      message: "Validation failed",
      errors: details,
    });
  }

  if (error?.name === "CastError") {
    return response.status(400).json({
      success: false,
      message: `Invalid ${error.path || "ID"} format`,
      errors: [
        {
          field: error.path || "id",
          message: `Invalid ${error.path || "ID"} format`,
        },
      ],
    });
  }

  if (error?.code === 11000 && error?.keyValue?.email) {
    return response.status(409).json({
      success: false,
      message: "Email already registered",
      errors: [{ field: "email", message: "Email already registered" }],
    });
  }

  if (statusCode >= 500) {
    return response.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }

  const payload = {
    success: false,
    message: error.message || "Something went wrong",
  };

  if (statusCode === 400 && error.details) {
    payload.errors = error.details;
  }

  return response.status(statusCode).json(payload);
};

export default errorMiddleware;
