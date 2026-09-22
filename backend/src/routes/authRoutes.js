import express from "express";

import {
  getCurrentUserController,
  login,
  logout,
  register,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  validateLoginInput,
  validateRegisterInput,
} from "../validators/authValidator.js";

const router = express.Router();

router.post("/register", validateRegisterInput, register);
router.post("/login", validateLoginInput, login);
router.get("/me", authMiddleware, getCurrentUserController);
router.post("/logout", logout);

export default router;
