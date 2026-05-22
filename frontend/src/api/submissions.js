import apiClient from './client';

export async function createSubmission(payload) {
  const response = await apiClient.post('/submissions', payload);
  return response.data?.data?.submission;
}

export async function listSubmissions() {
  const response = await apiClient.get('/submissions');
  return response.data?.data?.submissions || [];
}

export async function listLecturerPendingSubmissions() {
  const response = await apiClient.get('/lecturer/submissions');
  return response.data?.data?.submissions || [];
}

export async function getLecturerSubmission(submissionId) {
  const response = await apiClient.get(`/lecturer/submissions/${submissionId}`);
  return response.data?.data?.submission;
}

export async function updateLecturerSubmissionStatus(submissionId, status, reason) {
  const response = await apiClient.patch(`/lecturer/submissions/${submissionId}/status`, { status, reason });
  return response.data?.data?.submission;
}

export async function listLecturerSubmissionSimilaritySnapshots(submissionId) {
  const response = await apiClient.get(`/lecturer/submissions/${submissionId}/similarity-snapshots`);
  return response.data?.data?.snapshots || [];
}
