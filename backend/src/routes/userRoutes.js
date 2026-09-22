import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
  updateUserStatus,
} from "../controllers/userController.js";
import {
  validateCreateUserInput,
  validateListUsersQuery,
  validateUpdateStatusInput,
  validateUpdateUserInput,
  validateUserId,
} from "../validators/userValidator.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.get("/", validateListUsersQuery, getUsers);
router.post("/", validateCreateUserInput, createUser);
router.get("/:id", validateUserId, getUserById);
router.patch("/:id", validateUserId, validateUpdateUserInput, updateUser);
router.put("/:id", validateUserId, validateUpdateUserInput, updateUser);
router.patch(
  "/:id/status",
  validateUserId,
  validateUpdateStatusInput,
  updateUserStatus,
);
router.delete("/:id", validateUserId, deleteUser);

export default router;
