import apiClient from "../api/apiClient.js";

export const getCustomers = async (params = {}) =>
  (await apiClient.get("/customers", { params })).data;

export const getCustomer = async (id) =>
  (await apiClient.get(`/customers/${id}`)).data;

export const createCustomer = async (data) =>
  (await apiClient.post("/customers", data)).data;

export const updateCustomer = async (id, data) =>
  (await apiClient.put(`/customers/${id}`, data)).data;

export const deleteCustomer = async (id) =>
  (await apiClient.delete(`/customers/${id}`)).data;
