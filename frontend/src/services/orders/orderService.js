import apiClient from "../api/apiClient.js";

export const getOrders = async (params = {}) =>
  (await apiClient.get("/orders", { params })).data;

export const getOrder = async (id) =>
  (await apiClient.get(`/orders/${id}`)).data;

export const createOrder = async (data) =>
  (await apiClient.post("/orders", data)).data;

export const updateOrderStatus = async (id, status) =>
  (await apiClient.put(`/orders/${id}`, { status })).data;

export const cancelOrder = (id) => updateOrderStatus(id, "cancelled");

export const deleteOrder = async (id) =>
  (await apiClient.delete(`/orders/${id}`)).data;
