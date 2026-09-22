import apiClient from "../api/apiClient.js";

export const getDashboardMetrics = async () =>
  (await apiClient.get("/dashboard")).data;
