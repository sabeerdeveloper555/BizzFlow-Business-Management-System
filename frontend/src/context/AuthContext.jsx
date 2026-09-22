import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as authService from "../services/auth/authService.js";
import {
  getToken,
  removeToken,
  setToken,
} from "../services/api/tokenStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const restoreSession = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const response = await authService.getCurrentUser();
        setUser(response.user);
      } catch {
        removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    setToken(response.token);
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      removeToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: Boolean(user), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
