import apiClient from './client';

export async function getAdminDashboardSummary() {
  const response = await apiClient.get('/admin/dashboard/summary');
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function listAdminUsers(params = {}) {
  const response = await apiClient.get('/admin/users', { params });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function getAdminUserDetail(id) {
  const response = await apiClient.get(`/admin/users/${id}`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function updateAdminUserStatus(id, status) {
  const response = await apiClient.patch(`/admin/users/${id}/status`, { status });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function listAdminAuditLogs(params = {}) {
  const response = await apiClient.get('/admin/audit-logs', { params });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function getAdminAuditLogDetail(id) {
  const response = await apiClient.get(`/admin/audit-logs/${id}`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function getAdminReportsSummary() {
  const response = await apiClient.get('/admin/reports/summary');
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

export async function listAdminSettings() {
  const response = await apiClient.get('/admin/settings');
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
