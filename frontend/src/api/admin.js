import apiClient from './client';

export async function getAdminDashboardSummary() {
  const response = await apiClient.get('/admin/dashboard/summary');
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}
