import axios from 'axios';
import apiClient from './client';

function isSemanticUnavailablePayload(payload) {
  return payload?.status === 'semantic_unavailable' && payload.semanticAvailable === false;
}

function isSemanticUnavailableError(error) {
  return error.response?.status === 503 && isSemanticUnavailablePayload(error.response.data);
}

// One mapper for all three tiers: they differ only by which collection they
// select, so context fields cannot drift between them. The backend already
// collapses blank context to null, and that null is carried through unchanged
// so the display layer has exactly one absent case to skip.
function matchesForCollection(data, collection) {
  return (data.matches || [])
    .filter(match => match.collection === collection)
    .map(match => ({
      id: match.id,
      topic_title: match.title,
      category: match.category ?? null,
      collection: match.collection,
      session_year: match.session_year ?? null,
      supervisor_name: match.supervisor_name ?? null,
      population: match.population ?? null,
      location: match.location ?? null,
      study_focus: match.study_focus ?? null,
      semantic_score: match.semantic_score,
      similarity_class: match.similarity_class
    }));
}

function mapSimilarityResponse(responsePayload) {
  const data = responsePayload?.data;

  if (isSemanticUnavailablePayload(responsePayload)) {
    return {
      semantic_available: false,
      risk_level: null,
      max_similarity: null,
      corpus_size: null,
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
    // risk_level stays null when the backend asserted no classification
    // (empty comparison corpus); it must never be coerced to LOW.
    risk_level: data.overall_risk ?? null,
    max_similarity: data.max_similarity ?? null,
    corpus_size: data.corpus_size ?? null,
    recommendation: data.recommendation,
    semantic_available: responsePayload.semanticAvailable === true,
    tier1_matches: matchesForCollection(data, 'HISTORICAL'),
    tier2_matches: matchesForCollection(data, 'CURRENT_SESSION'),
    tier3_matches: matchesForCollection(data, 'UNDER_REVIEW')
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
  return normalizeSemanticUnavailable(() => axios.post('/api/similarity/check', payload, {
    signal,
    // The production checker is authenticated. This is explicit even though
    // same-origin browsers include cookies by default, and keeps the caller
    // correct when a configured reverse proxy presents the API separately.
    withCredentials: true
  }));
}

export async function runLecturerSubmissionSimilarityCheck(submissionId) {
  return normalizeSemanticUnavailable(() => apiClient.post(
    `/lecturer/submissions/${submissionId}/similarity-check`,
    {}
  ));
}

export { isSemanticUnavailablePayload };
