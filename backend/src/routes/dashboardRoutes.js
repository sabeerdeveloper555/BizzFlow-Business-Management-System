import express from "express";
import getDashboardController from "../controllers/dashboardController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin", "staff"));
router.get("/", getDashboardController);

export default router;
