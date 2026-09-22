import { getDashboard } from "../services/dashboardService.js";

const getDashboardController = async (_request, response, next) => {
  try {
    const dashboard = await getDashboard();

    response.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
};

export default getDashboardController;
