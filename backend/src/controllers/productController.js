import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from "../services/productService.js";

export const getProducts = async (request, response, next) => {
  try {
    const result = await listProducts(request.query);

    response.status(200).json({
      success: true,
      data: {
        products: result.products,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductByIdController = async (request, response, next) => {
  try {
    const product = await getProductById(request.params.id);

    response.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createProductController = async (request, response, next) => {
  try {
    const product = await createProduct(request.body);

    response.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProductController = async (request, response, next) => {
  try {
    const product = await updateProduct(request.params.id, request.body);

    response.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductController = async (request, response, next) => {
  try {
    await deleteProduct(request.params.id);

    response.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
