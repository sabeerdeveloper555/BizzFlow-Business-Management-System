import apiClient from "../api/apiClient.js";

export const getUsers = async (params = {}) =>
  (await apiClient.get("/users", { params })).data;

export const getUser = async (id) => (await apiClient.get(`/users/${id}`)).data;

export const createStaff = async (data) =>
  (await apiClient.post("/users", data)).data;

export const updateUser = async (id, data) =>
  (await apiClient.patch(`/users/${id}`, data)).data;

export const updateUserStatus = async (id, status) =>
  (await apiClient.patch(`/users/${id}/status`, { status })).data;

export const deleteUser = async (id) =>
  (await apiClient.delete(`/users/${id}`)).data;
