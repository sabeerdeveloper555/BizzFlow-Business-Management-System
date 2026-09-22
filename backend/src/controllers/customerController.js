import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../services/customerService.js";

export const getCustomers = async (request, response, next) => {
  try {
    const result = await listCustomers(request.query);

    response.status(200).json({
      success: true,
      data: {
        customers: result.customers,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerByIdController = async (request, response, next) => {
  try {
    const customer = await getCustomerById(request.params.id);

    response.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCustomerController = async (request, response, next) => {
  try {
    const customer = await createCustomer(request.body);

    response.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomerController = async (request, response, next) => {
  try {
    const customer = await updateCustomer(request.params.id, request.body);

    response.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomerController = async (request, response, next) => {
  try {
    await deleteCustomer(request.params.id);

    response.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
