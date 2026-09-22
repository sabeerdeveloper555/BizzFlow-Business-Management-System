const notFoundMiddleware = (request, response) => {
  response.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export default notFoundMiddleware;
