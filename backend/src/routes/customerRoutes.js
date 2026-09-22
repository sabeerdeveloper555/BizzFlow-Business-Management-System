import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import {
  createCustomerController,
  deleteCustomerController,
  getCustomerByIdController,
  getCustomers,
  updateCustomerController,
} from "../controllers/customerController.js";
import {
  validateCustomerId,
  validateCreateCustomerInput,
  validateListCustomersQuery,
  validateUpdateCustomerInput,
} from "../validators/customerValidator.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin", "staff"));

router.get("/", validateListCustomersQuery, getCustomers);
router.post("/", validateCreateCustomerInput, createCustomerController);
router.get("/:id", validateCustomerId, getCustomerByIdController);
router.put(
  "/:id",
  validateCustomerId,
  validateUpdateCustomerInput,
  updateCustomerController,
);
router.delete("/:id", validateCustomerId, deleteCustomerController);

export default router;
