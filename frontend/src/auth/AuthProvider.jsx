import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../api/client';
import AuthContext from './authContext';

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

  // One field carries either an email address or a student matric number; the
  // backend decides how to resolve it and never reveals which path it took.
  const login = useCallback(async ({ identifier, password }) => {
    const response = await apiClient.post('/auth/login', { identifier, password });
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

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const response = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
    const nextUser = response.data?.data?.user || null;
    if (nextUser) {
      setUser(nextUser);
    }
    return response.data;
  }, []);

  // Invitation tokens live only in memory for the duration of these calls;
  // they are never written to storage.
  const validateInvitation = useCallback(async ({ token }) => {
    const response = await apiClient.post('/auth/invitation/validate', { token });
    return response.data;
  }, []);

  const acceptInvitation = useCallback(async ({ token, password }) => {
    const response = await apiClient.post('/auth/invitation/accept', { token, password });
    const nextUser = response.data?.data?.user || null;
    if (nextUser) {
      setUser(nextUser);
    }
    return response.data;
  }, []);

  const value = useMemo(() => ({
    acceptInvitation,
    changePassword,
    forgotPassword,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    refreshUser,
    resetPassword,
    user,
    validateInvitation
  }), [acceptInvitation, changePassword, forgotPassword, isLoading, login, logout, refreshUser, resetPassword, user, validateInvitation]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};
