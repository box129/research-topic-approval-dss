import axios from 'axios';

function mapFypTier1Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.year || '',
    category: match.category || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert,
    combined_similarity_score: match.sbert ?? match.jaccard ?? 0
  }));
}

function mapFypTier2Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.approved_date || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert,
    combined_similarity_score: match.sbert ?? match.jaccard ?? 0
  }));
}

function mapFypTier3Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.reviewing_lecturer || '',
    session_year: match.review_started_at || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert,
    combined_similarity_score: match.sbert ?? match.jaccard ?? 0
  }));
}

function mapSimilarityResponse(responsePayload) {
  const data = responsePayload?.data;

  if (!data || !['success', 'partial_success'].includes(responsePayload.status)) {
    throw new Error('Invalid similarity response format from server.');
  }

  return {
    risk_level: data.overall_risk || 'LOW',
    max_similarity: data.max_similarity ?? 0,
    recommendation: data.recommendation,
    sbert_available: responsePayload.status !== 'partial_success',
    tier1_matches: mapFypTier1Matches(data.tier1_historical),
    tier2_matches: mapFypTier2Matches(data.tier2_current),
    tier3_matches: mapFypTier3Matches(data.tier3_under_review)
  };
}

export async function runSimilarityCheck({ topic, keywords }) {
  const response = await axios.post('/api/similarity/check', {
    topic,
    keywords: keywords || ''
  });

  return {
    status: response.data?.status,
    message: response.data?.message,
    results: mapSimilarityResponse(response.data)
  };
}
