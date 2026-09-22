import apiClient from "../api/apiClient.js";

export const getProducts = async (params = {}) =>
  (await apiClient.get("/products", { params })).data;

export const getProduct = async (id) =>
  (await apiClient.get(`/products/${id}`)).data;

export const createProduct = async (data) =>
  (await apiClient.post("/products", data)).data;

export const updateProduct = async (id, data) =>
  (await apiClient.put(`/products/${id}`, data)).data;

export const deleteProduct = async (id) =>
  (await apiClient.delete(`/products/${id}`)).data;
