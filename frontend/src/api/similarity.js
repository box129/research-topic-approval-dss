import axios from 'axios';
import apiClient from './client';

function isSemanticUnavailablePayload(payload) {
  return payload?.status === 'semantic_unavailable' && payload.semanticAvailable === false;
}

function isSemanticUnavailableError(error) {
  return error.response?.status === 503 && isSemanticUnavailablePayload(error.response.data);
}

function mapSimilarityResponse(responsePayload) {
  const data = responsePayload?.data;

  if (isSemanticUnavailablePayload(responsePayload)) {
    return {
      semantic_available: false,
      risk_level: null,
      max_similarity: null,
      recommendation: responsePayload.message,
      tier1_matches: [],
      tier2_matches: [],
      tier3_matches: []
    };
  }
  if (!data || responsePayload.status !== 'success') {
    throw new Error('Invalid similarity response format from server.');
  }

  return {
    risk_level: data.overall_risk,
    max_similarity: data.max_similarity,
    recommendation: data.recommendation,
    semantic_available: responsePayload.semanticAvailable === true,
    tier1_matches: (data.matches || []).map(match => ({
      id: match.id,
      topic_title: match.title,
      semantic_score: match.semantic_score,
      similarity_class: match.similarity_class
    })),
    tier2_matches: [], tier3_matches: []
  };
}

function normalizeSimilarityResponse(responsePayload) {
  return {
    status: responsePayload?.status,
    message: responsePayload?.message,
    semanticAvailable: responsePayload?.semanticAvailable,
    semanticProvider: responsePayload?.semanticProvider,
    semanticModel: responsePayload?.semanticModel,
    results: mapSimilarityResponse(responsePayload)
  };
}

async function normalizeSemanticUnavailable(request) {
  try {
    const response = await request();
    return normalizeSimilarityResponse(response.data);
  } catch (error) {
    if (isSemanticUnavailableError(error)) {
      return normalizeSimilarityResponse(error.response.data);
    }
    throw error;
  }
}

export async function runSimilarityCheck(payload, { signal } = {}) {
  return normalizeSemanticUnavailable(() => axios.post('/api/similarity/check', payload, { signal }));
}

export async function runLecturerSubmissionSimilarityCheck(submissionId) {
  return normalizeSemanticUnavailable(() => apiClient.post(
    `/lecturer/submissions/${submissionId}/similarity-check`,
    {}
  ));
}

export { isSemanticUnavailablePayload };
