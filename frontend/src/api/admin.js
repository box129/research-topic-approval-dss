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

export async function createAdminUser(payload) {
  const response = await apiClient.post('/admin/users', payload);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function resetAdminUserCredential(id) {
  const response = await apiClient.post(`/admin/users/${id}/credential-reset`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function correctAdminUserIdentity(id, payload) {
  const response = await apiClient.patch(`/admin/users/${id}/identity`, payload);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function inviteAdminUser(id) {
  const response = await apiClient.post(`/admin/users/${id}/invite`);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

// Synchronous bounded-concurrency batch; can take a while for large cohorts.
export async function sendAdminBulkInvitations(userIds) {
  const response = await apiClient.post('/admin/users/invitations/bulk', { userIds }, { timeout: 0 });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

function buildUserImportFormData(file) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

export async function previewAdminUserImport(file) {
  const response = await apiClient.post('/admin/users/import/preview', buildUserImportFormData(file));
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

// Commit performs server-side credential hashing for the whole cohort, which
// can take minutes at departmental scale; no client timeout is applied.
export async function commitAdminUserImport(file) {
  const response = await apiClient.post('/admin/users/import/commit', buildUserImportFormData(file), {
    timeout: 0
  });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function downloadAdminUserImportTemplate() {
  const response = await apiClient.get('/admin/users/import/template', {
    responseType: 'blob'
  });

  return {
    blob: response.data,
    filename: getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'user-onboarding-template.xlsx'
    )
  };
}

export async function listAdminSuperviseeAssignments(params = {}) {
  const response = await apiClient.get('/admin/supervisee-assignments', { params });
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function createAdminSuperviseeAssignment(payload) {
  const response = await apiClient.post('/admin/supervisee-assignments', payload);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function endAdminSuperviseeAssignment(id) {
  const response = await apiClient.delete(`/admin/supervisee-assignments/${id}`);
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

export async function previewAdminAuditLogPurge(payload) {
  const response = await apiClient.post('/admin/audit-logs/purge-preview', payload);
  return {
    data: response.data?.data,
    meta: response.data?.meta
  };
}

export async function purgeAdminAuditLogs(payload) {
  const response = await apiClient.post('/admin/audit-logs/purge', payload);
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

function getFilenameFromDisposition(disposition, fallback) {
  const match = String(disposition || '').match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export async function exportAdminReport(type) {
  const response = await apiClient.get(`/admin/reports/export/${type}`, {
    responseType: 'blob'
  });

  return {
    blob: response.data,
    contentType: response.headers?.['content-type'] || 'text/csv; charset=utf-8',
    filename: getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      `admin-${type}-export.csv`
    )
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

function buildTopicImportFormData(file) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

export async function previewAdminTopicImport(file) {
  const response = await apiClient.post('/admin/import/topics/preview', buildTopicImportFormData(file));
  return {
    data: response.data?.data,
    status: response.data?.status
  };
}

export async function commitAdminTopicImport(file) {
  const response = await apiClient.post('/admin/import/topics/commit', buildTopicImportFormData(file));
  return {
    data: response.data?.data,
    status: response.data?.status
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
