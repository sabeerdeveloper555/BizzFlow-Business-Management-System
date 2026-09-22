import axios from "axios";
import { normalizeApiError } from "./apiError.js";
import { getToken, removeToken } from "./tokenStorage.js";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) removeToken();
    return Promise.reject(normalizeApiError(error));
  },
);

export default apiClient;
