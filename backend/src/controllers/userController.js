import {
  createStaff,
  deleteStaff,
  getUserById as getStaffById,
  listUsers as listStaff,
  updateStaff,
  updateStaffStatus,
} from "../services/userService.js";

export const getUsers = async (request, response, next) => {
  try {
    const result = await listStaff(request.query);

    response.status(200).json({
      success: true,
      data: {
        users: result.users,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (request, response, next) => {
  try {
    const user = await getStaffById(request.params.id);

    response.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (request, response, next) => {
  try {
    const user = await createStaff(request.body);

    response.status(201).json({
      success: true,
      message: "Staff user created successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (request, response, next) => {
  try {
    const user = await updateStaff(
      request.params.id,
      request.body,
      request.user._id,
    );

    response.status(200).json({
      success: true,
      message: "Staff user updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (request, response, next) => {
  try {
    const user = await updateStaffStatus(
      request.params.id,
      request.body.status,
      request.user._id,
    );

    response.status(200).json({
      success: true,
      message: "Staff user status updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (request, response, next) => {
  try {
    await deleteStaff(request.params.id, request.user._id);

    response.status(200).json({
      success: true,
      message: "Staff user deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
