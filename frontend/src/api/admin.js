import apiClient from './client';

export async function getAdminDashboardSummary() {
  const response = await apiClient.get('/admin/dashboard/summary');
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function listAdminTopics(params = {}) {
  const response = await apiClient.get('/admin/topics', { params });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function getAdminTopicsSummary() {
  const response = await apiClient.get('/admin/topics/summary');
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function getAdminTopicDetail(lifecycle, id) {
  const response = await apiClient.get(`/admin/topics/${lifecycle}/${id}`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}
