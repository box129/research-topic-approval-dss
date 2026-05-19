import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      const nextUser = response.data?.data?.user || null;
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async ({ email, password }) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const nextUser = response.data?.data?.user || null;
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const forgotPassword = useCallback(async ({ email }) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  }, []);

  const resetPassword = useCallback(async ({ token, password }) => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  }, []);

  const value = useMemo(() => ({
    forgotPassword,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    refreshUser,
    resetPassword,
    user
  }), [forgotPassword, isLoading, login, logout, refreshUser, resetPassword, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
