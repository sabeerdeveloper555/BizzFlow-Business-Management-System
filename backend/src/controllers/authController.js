import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../services/authService.js";

export const register = async (request, response, next) => {
  try {
    const user = await registerUser(request.body);

    response.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (request, response, next) => {
  try {
    const result = await loginUser(request.body);

    response.status(200).json({
      success: true,
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUserController = async (request, response, next) => {
  try {
    const user = await getCurrentUser(request.user._id);

    response.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (_request, response) => {
  response.status(200).json({
    success: true,
    message:
      "Logged out successfully. Remove the token from the client storage.",
  });
};
