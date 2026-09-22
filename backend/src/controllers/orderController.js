import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
} from "../services/orderService.js";

export const getOrders = async (request, response, next) => {
  try {
    const result = await listOrders(request.query);

    response.status(200).json({
      success: true,
      data: {
        orders: result.orders,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderByIdController = async (request, response, next) => {
  try {
    const order = await getOrderById(request.params.id);

    response.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createOrderController = async (request, response, next) => {
  try {
    const order = await createOrder(request.body);

    response.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderController = async (request, response, next) => {
  try {
    const order = await updateOrderStatus(
      request.params.id,
      request.body.status,
    );

    response.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOrderController = async (request, response, next) => {
  try {
    await deleteOrder(request.params.id);

    response.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
