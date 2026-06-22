import apiClient from './client';

export async function listNotifications(params = {}) {
  const response = await apiClient.get('/notifications', { params });
  return {
    data: response.data?.data || { items: [] },
    meta: response.data?.meta || {}
  };
}

export async function markNotificationRead(id) {
  const response = await apiClient.patch(`/notifications/${id}/read`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function markAllNotificationsRead() {
  const response = await apiClient.patch('/notifications/read-all');
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}
