import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import {
  createOrderController,
  deleteOrderController,
  getOrderByIdController,
  getOrders,
  updateOrderController,
} from "../controllers/orderController.js";
import {
  validateCreateOrderInput,
  validateListOrdersQuery,
  validateOrderId,
  validateUpdateOrderInput,
} from "../validators/orderValidator.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin", "staff"));

router.get("/", validateListOrdersQuery, getOrders);
router.post("/", validateCreateOrderInput, createOrderController);
router.get("/:id", validateOrderId, getOrderByIdController);
router.put(
  "/:id",
  validateOrderId,
  validateUpdateOrderInput,
  updateOrderController,
);
router.delete("/:id", validateOrderId, deleteOrderController);

export default router;
