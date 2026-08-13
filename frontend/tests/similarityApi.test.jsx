import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  clientPost: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    post: mocks.apiPost,
    create: vi.fn(() => ({ post: mocks.clientPost }))
  }
}));

import { runLecturerSubmissionSimilarityCheck, runSimilarityCheck } from '../src/api/similarity';

const unavailable = {
  status: 'semantic_unavailable',
  semanticAvailable: false,
  semanticProvider: 'voyage',
  semanticModel: 'voyage-4-large',
  message: 'Semantic analysis is currently unavailable.'
};

const successful = {
  status: 'success',
  semanticAvailable: true,
  semanticProvider: 'voyage',
  semanticModel: 'voyage-4-large',
  data: {
    overall_risk: 'MEDIUM',
    max_similarity: 0.6,
    matches: [{ id: 1, title: 'Stored topic', semantic_score: 0.6, similarity_class: 'MEDIUM' }]
  }
};

describe('similarity API adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes only the explicit Axios 503 semantic-unavailable envelope', async () => {
    mocks.apiPost.mockRejectedValue({ response: { status: 503, data: unavailable } });

    await expect(runSimilarityCheck({ topic: 'New topic' })).resolves.toEqual({
      status: 'semantic_unavailable',
      message: unavailable.message,
      semanticAvailable: false,
      semanticProvider: 'voyage',
      semanticModel: 'voyage-4-large',
      results: {
        semantic_available: false,
        risk_level: null,
        max_similarity: null,
        recommendation: unavailable.message,
        tier1_matches: [],
        tier2_matches: [],
        tier3_matches: []
      }
    });
  });

  it('keeps generic 503, generic 500, and network failures rejected', async () => {
    const generic503 = { response: { status: 503, data: { message: 'Temporarily unavailable.' } } };
    const generic500 = { response: { status: 500, data: { message: 'Server error.' } } };
    const networkFailure = new Error('Network Error');
    mocks.apiPost.mockRejectedValueOnce(generic503).mockRejectedValueOnce(generic500).mockRejectedValueOnce(networkFailure);

    await expect(runSimilarityCheck({ topic: 'New topic' })).rejects.toBe(generic503);
    await expect(runSimilarityCheck({ topic: 'New topic' })).rejects.toBe(generic500);
    await expect(runSimilarityCheck({ topic: 'New topic' })).rejects.toBe(networkFailure);
  });

  it('preserves successful semantic results and normalizes the lecturer adapter too', async () => {
    mocks.apiPost.mockResolvedValue({ data: successful });
    mocks.clientPost.mockRejectedValue({ response: { status: 503, data: unavailable } });

    await expect(runSimilarityCheck({ topic: 'New topic' })).resolves.toMatchObject({
      status: 'success',
      semanticAvailable: true,
      results: {
        semantic_available: true,
        risk_level: 'MEDIUM',
        max_similarity: 0.6,
        tier1_matches: [{ semantic_score: 0.6 }]
      }
    });
    await expect(runLecturerSubmissionSimilarityCheck(42)).resolves.toMatchObject({
      status: 'semantic_unavailable',
      semanticAvailable: false,
      results: { semantic_available: false, risk_level: null, tier1_matches: [] }
    });
  });
});
