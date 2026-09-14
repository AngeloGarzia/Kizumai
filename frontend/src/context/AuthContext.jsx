import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { ApiError, ensureCsrfToken } from '../services/api.js';
import {
  clearProjectDraft,
  clearSearchProgress,
  clearSearchSeed,
} from '../services/projectService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      await ensureCsrfToken();
      const currentUser = await authService.getMe();
      setUser(currentUser);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const refreshedUser = await authService.refreshSession();
          setUser(refreshedUser);
          return;
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password, options = {}) => {
    const loggedUser = await authService.login(email, password, options);
    setUser(loggedUser);
    return loggedUser;
  };

  const register = useCallback(async (name, email, password) => {
    const result = await authService.register({ name, email, password });
    if (result?.pendingVerification) {
      return result;
    }
    if (result?.user) {
      setUser(result.user);
      return result;
    }
    return result;
  }, []);

  const confirmEmail = useCallback(async (token) => {
    const user = await authService.confirmEmail(token);
    setUser(user);
    return user;
  }, []);

  const logout = async () => {
    await authService.logout();
    clearProjectDraft();
    clearSearchSeed();
    clearSearchProgress();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      confirmEmail,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isUser: user?.role === 'user' || user?.role === 'admin',
      isPaid: user?.role === 'admin' || user?.plan === 'paid',
      loadUser,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
