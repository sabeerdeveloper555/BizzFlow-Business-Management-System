import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import {
  createProductController,
  deleteProductController,
  getProductByIdController,
  getProducts,
  updateProductController,
} from "../controllers/productController.js";
import {
  validateCreateProductInput,
  validateListProductsQuery,
  validateProductId,
  validateUpdateProductInput,
} from "../validators/productValidator.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin", "staff"));

router.get("/", validateListProductsQuery, getProducts);
router.post("/", validateCreateProductInput, createProductController);
router.get("/:id", validateProductId, getProductByIdController);
router.put(
  "/:id",
  validateProductId,
  validateUpdateProductInput,
  updateProductController,
);
router.delete("/:id", validateProductId, deleteProductController);

export default router;
