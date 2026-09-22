export const normalizeApiError = (error) => {
  if (!error.response) {
    return {
      status: null,
      type: "network",
      message: "Unable to reach the BizFlow API. Check your connection.",
      details: [],
      originalError: error,
    };
  }

  const { status, data } = error.response;
  const typeByStatus = {
    400: "validation",
    401: "authentication",
    403: "authorization",
    404: "not-found",
    409: "conflict",
  };

  return {
    status,
    type: typeByStatus[status] || (status >= 500 ? "server" : "unknown"),
    message: data?.message || "The request could not be completed.",
    details: data?.errors || [],
    originalError: error,
  };
};
