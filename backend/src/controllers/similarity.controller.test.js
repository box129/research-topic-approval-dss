const request = require('supertest');
const express = require('express');
const { checkSimilarity } = require('./similarity.controller');
const { errorHandler } = require('../middleware/errorHandler.middleware');

// Mock dependencies before requiring them
jest.mock('@prisma/client', () => {
  const mockQueryRaw = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: mockQueryRaw
    })),
    Prisma: {
      sql: jest.fn()
    }
  };
});

jest.mock('../services/jaccard.service');
jest.mock('../services/tfidf.service');
jest.mock('../services/sbert.service');
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { PrismaClient } = require('@prisma/client');
const jaccardService = require('../services/jaccard.service');
const tfidfService = require('../services/tfidf.service');
const sbertService = require('../services/sbert.service');

describe('Similarity Controller', () => {
  let app;
  let mockPrismaInstance;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.post('/api/similarity/check', checkSimilarity);
    
    // Error handler
    app.use(errorHandler);

    // Get the mock Prisma instance
    mockPrismaInstance = new PrismaClient();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/similarity/check', () => {
    it('should return 400 if topic is missing', async () => {
      const response = await request(app)
        .post('/api/similarity/check')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Topic is required');
    });

    it('should expose intended FYP_Selected error response contract for validation errors', async () => {
      // Reconciliation spec based on authoritative FYP_Selected error-contract docs.
      // This verifies the intended error envelope only, not expanded validation rules.
      const response = await request(app)
        .post('/api/similarity/check')
        .send({});

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('field', 'topic');
      expect(response.body.details).toHaveProperty('error_code');
    });

    it('should expose intended FYP_Selected shared error response contract for malformed JSON', async () => {
      // Reconciliation spec based on authoritative FYP_Selected shared error-contract docs.
      // This verifies the intended middleware-driven invalid request format envelope only.
      const response = await request(app)
        .post('/api/similarity/check')
        .set('Content-Type', 'application/json')
        .send('{"topic": invalid json}');

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Invalid request format.');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('error_code', 'INVALID_FORMAT');
    });

    it('should return 400 if topic is empty string', async () => {
      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('details');
    });

    it('should expose intended FYP_Selected database error response contract', async () => {
      // Reconciliation spec based on authoritative FYP_Selected database-error docs.
      // This uses the controller-level Prisma mock so the DB query path reliably fails.
      mockPrismaInstance.$queryRaw.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({
          topic: 'Machine Learning Applications in Healthcare Diagnosis'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Database connection failed. Please try again later.');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('error_code', 'DB_CONNECTION_ERROR');
    });

    it('should return LOW risk with empty tiers when no topics exist in database', async () => {
      // Mock empty database
      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([]) // historical_topics
        .mockResolvedValueOnce([]) // current_session_topics
        .mockResolvedValueOnce([]); // under_review_topics

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ 
          topic: 'Machine Learning Applications',
          keywords: 'neural networks, deep learning'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('input_topic', 'Machine Learning Applications');
      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
      expect(response.body.data).toHaveProperty('max_similarity', 0);
      expect(response.body.data.tier1_historical).toHaveLength(0);
      expect(response.body.data.tier2_current).toHaveLength(0);
      expect(response.body.data.tier3_under_review).toHaveLength(0);
    });

    it('should expose intended FYP_Selected no-topics success response contract', async () => {
      // Reconciliation spec based on authoritative FYP_Selected docs.
      // The no-topics success envelope is inferred from the documented success contract and UI workflow.
      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([]) // historical_topics
        .mockResolvedValueOnce([]) // current_session_topics
        .mockResolvedValueOnce([]); // under_review_topics

      const response = await request(app)
        .post('/api/similarity/check')
        .send({
          topic: 'Machine Learning Applications',
          keywords: 'neural networks, deep learning'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');

      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
      expect(response.body.data).toHaveProperty('max_similarity', 0);
      expect(response.body.data).toHaveProperty('tier1_historical');
      expect(response.body.data.tier1_historical).toEqual([]);
      expect(response.body.data).toHaveProperty('tier2_current');
      expect(response.body.data.tier2_current).toEqual([]);
      expect(response.body.data).toHaveProperty('tier3_under_review');
      expect(response.body.data.tier3_under_review).toEqual([]);
      expect(response.body.data).toHaveProperty(
        'recommendation',
        'Topic appears unique. Proceed with approval.'
      );
    });

    it('should successfully check similarity with all algorithms', async () => {
      // Mock database responses
      const mockHistoricalTopics = [
        {
          id: 1,
          title: 'Deep Learning for Image Recognition',
          keywords: 'CNN, neural networks',
          session_year: '2023',
          supervisor_name: 'Dr. Smith',
          category: 'AI',
          embedding: '[0.1, 0.2, 0.3]' // Mock embedding (should be 384-dim)
        }
      ];

      const mockCurrentSessionTopics = [
        {
          id: 2,
          title: 'Machine Learning in Healthcare',
          keywords: 'ML, medical diagnosis',
          session_year: '2024',
          supervisor_name: 'Dr. Johnson',
          category: 'AI',
          student_id: 'S12345',
          embedding: '[0.2, 0.3, 0.4]'
        }
      ];

      const mockUnderReviewTopics = [];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce(mockCurrentSessionTopics)
        .mockResolvedValueOnce(mockUnderReviewTopics);

      // Mock algorithm results
      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: 'Deep Learning for Image Recognition', score: 0.75, matchedKeywords: ['learn', 'neural'] },
        { topicId: 2, title: 'Machine Learning in Healthcare', score: 0.85, matchedKeywords: ['machin', 'learn'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: 'Deep Learning for Image Recognition', score: 0.70, matchedTerms: ['deep', 'learning'] },
        { topicId: 2, title: 'Machine Learning in Healthcare', score: 0.80, matchedTerms: ['machine', 'learning'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 1, title: 'Deep Learning for Image Recognition', score: 0.82, usedPrecomputed: true },
        { topicId: 2, title: 'Machine Learning in Healthcare', score: 0.88, usedPrecomputed: true }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ 
          topic: 'Machine Learning Applications',
          keywords: 'neural networks'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('input_topic', 'Machine Learning Applications');
      expect(response.body.data).toHaveProperty('overall_risk');
      expect(response.body.data).toHaveProperty('tier1_historical');
      expect(response.body.data).toHaveProperty('tier2_current');
      expect(response.body.data).toHaveProperty('tier3_under_review');
    });

    it('should expose intended API contract with percentage-style match scores', async () => {
      // Reconciliation spec based on docs/source-of-truth.md and docs/business-rules.md.
      // This verifies the intended public contract/score scale only, not tier or risk logic.
      const mockHistoricalTopics = [
        {
          id: 1,
          title: 'Deep Learning for Medical Image Analysis',
          keywords: 'CNN, radiology, diagnosis',
          session_year: '2023',
          supervisor_name: 'Dr. Smith',
          category: 'Public Health',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        {
          topicId: 1,
          title: 'Deep Learning for Medical Image Analysis',
          score: 0.75,
          matchedKeywords: ['deep', 'learn']
        }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        {
          topicId: 1,
          title: 'Deep Learning for Medical Image Analysis',
          score: 0.65,
          matchedTerms: ['medical', 'image']
        }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        {
          topicId: 1,
          title: 'Deep Learning for Medical Image Analysis',
          score: 0.85,
          usedPrecomputed: false
        }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({
          topic: 'Deep Learning for Medical Image Diagnosis',
          keywords: 'radiology, CNN'
        });

      expect(response.status).toBe(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.overall_risk).toBeDefined();

      expect(response.body.data).toBeDefined();
      expect(response.body.data.tier1_historical).toBeDefined();
      expect(response.body.data.tier2_current).toBeDefined();
      expect(response.body.data.tier3_under_review).toBeDefined();

      const firstMatch = response.body.data.tier1_historical[0];
      expect(firstMatch.jaccard).toBe(75);
      expect(firstMatch.tfidf).toBe(65);
      expect(firstMatch.sbert).toBe(85);
    });

    it('should expose intended FYP_Selected successful response contract', async () => {
      // Reconciliation spec based on authoritative FYP_Selected/API-Specifications.md.
      // This verifies the intended successful response object shape only, not tier or risk logic.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 45,
          title: 'Malaria prevention in children',
          keywords: 'malaria, prevention, children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.653,
          matchedKeywords: ['malaria', 'prevention', 'children']
        }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.721,
          matchedTerms: ['malaria', 'prevention', 'children']
        }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.842,
          usedPrecomputed: false
        }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({
          topic,
          keywords: 'malaria, children, prevention, Osogbo'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data).toHaveProperty('input_topic', topic);
      expect(data).toHaveProperty('word_count');
      expect(data).toHaveProperty('char_count');
      expect(data).toHaveProperty('overall_risk');
      expect(data).toHaveProperty('max_similarity');
      expect(data).toHaveProperty('tier1_historical');
      expect(data).toHaveProperty('tier2_current');
      expect(data).toHaveProperty('tier3_under_review');
      expect(data).toHaveProperty('recommendation');

      const tier1Match = data.tier1_historical[0];
      expect(tier1Match).toHaveProperty('id');
      expect(tier1Match).toHaveProperty('title');
      expect(tier1Match).toHaveProperty('year');
      expect(tier1Match).toHaveProperty('supervisor');
      expect(tier1Match).toHaveProperty('category');
      expect(tier1Match).toHaveProperty('jaccard');
      expect(tier1Match).toHaveProperty('tfidf');
      expect(tier1Match).toHaveProperty('sbert');
      expect(tier1Match).toHaveProperty('matched_keywords');
      expect(tier1Match).not.toHaveProperty('combined');
      expect(tier1Match).not.toHaveProperty('scores.combined');
    });

    it('should handle SBERT service failure gracefully', async () => {
      // Mock database responses
      const mockHistoricalTopics = [
        {
          id: 1,
          title: 'Test Topic',
          keywords: 'test',
          session_year: '2023',
          supervisor_name: 'Dr. Test',
          category: 'Test',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock algorithm results
      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: 'Test Topic', score: 0.50, matchedKeywords: ['test'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: 'Test Topic', score: 0.45, matchedTerms: ['test'] }
      ]);

      // SBERT service fails
      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Test Topic' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'partial_success');
      expect(response.body).toHaveProperty('message');
      // Should still return results using Jaccard and TF-IDF only
      expect(response.body.data.tier1_historical).toBeDefined();
      expect(response.body.data.tier1_historical[0]).toHaveProperty('sbert', null);
    });

    it('should expose intended FYP_Selected partial-success response contract when SBERT is unavailable', async () => {
      // Reconciliation spec based on authoritative FYP_Selected partial-success docs.
      // This verifies the intended degraded response object shape only, not tier or risk logic.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 45,
          title: 'Malaria prevention in children',
          keywords: 'malaria, prevention, children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.653,
          matchedKeywords: ['malaria', 'prevention', 'children']
        }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.721,
          matchedTerms: ['malaria', 'prevention', 'children']
        }
      ]);

      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({
          topic,
          keywords: 'malaria, children, prevention, Osogbo'
        });

      expect(response.body).toHaveProperty('status', 'partial_success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data).toHaveProperty('input_topic', topic);
      expect(data).toHaveProperty('word_count');
      expect(data).toHaveProperty('char_count');
      expect(data).toHaveProperty('overall_risk');
      expect(data).toHaveProperty('max_similarity');
      expect(data).toHaveProperty('tier1_historical');
      expect(data).toHaveProperty('tier2_current');
      expect(data).toHaveProperty('tier3_under_review');

      const tier1Match = data.tier1_historical[0];
      expect(tier1Match).toHaveProperty('id');
      expect(tier1Match).toHaveProperty('title');
      expect(tier1Match).toHaveProperty('year');
      expect(tier1Match).toHaveProperty('supervisor');
      expect(tier1Match).toHaveProperty('category');
      expect(tier1Match).toHaveProperty('jaccard');
      expect(tier1Match).toHaveProperty('tfidf');
      expect(tier1Match).toHaveProperty('sbert', null);
      expect(tier1Match).toHaveProperty('matched_keywords');
    });

    it('should base degraded risk and max similarity on approved fallback combined score when SBERT is unavailable', async () => {
      // Reconciliation spec based on authoritative FYP_Selected degraded-mode rules.
      // This verifies degraded risk/max only; tier membership, ordering, and recommendations are out of scope here.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 45,
          title: 'Malaria prevention in children',
          keywords: 'malaria, prevention, children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.35,
          matchedKeywords: ['malaria']
        }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        {
          topicId: 45,
          title: 'Malaria prevention in children',
          score: 0.40,
          matchedTerms: ['malaria']
        }
      ]);

      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'partial_success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('max_similarity', 38);
      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
    });

    it('should keep degraded Tier 2 and Tier 3 empty because semantic evidence is unavailable', async () => {
      // Tier 2/3 require real SBERT evidence under the approved contract.
      // Lexical fallback must not fabricate semantic eligibility.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockCurrentSessionTopics = [
        {
          id: 202,
          title: 'Malaria prevention campaign for children',
          keywords: 'malaria prevention children',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Balogun',
          category: 'Public Health',
          approved_date: new Date('2026-01-15T10:30:00Z'),
          student_id: 'STU-2024-103',
          embedding: null
        }
      ];
      const mockUnderReviewTopics = [
        {
          id: 303,
          title: 'Childhood malaria prevention strategies',
          keywords: 'childhood malaria prevention',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Ibrahim',
          category: 'Public Health',
          review_started_at: new Date('2026-01-31T14:45:00Z'),
          reviewing_lecturer: 'Dr. Ibrahim',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCurrentSessionTopics)
        .mockResolvedValueOnce(mockUnderReviewTopics);

      jaccardService.calculateBatch.mockReturnValue([
        {
          topicId: 202,
          title: mockCurrentSessionTopics[0].title,
          score: 0.62,
          matchedKeywords: ['malaria', 'prevention']
        },
        {
          topicId: 303,
          title: mockUnderReviewTopics[0].title,
          score: 0.25,
          matchedKeywords: ['malaria']
        }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        {
          topicId: 202,
          title: mockCurrentSessionTopics[0].title,
          score: 0.20,
          matchedTerms: ['malaria']
        },
        {
          topicId: 303,
          title: mockUnderReviewTopics[0].title,
          score: 0.64,
          matchedTerms: ['childhood', 'malaria', 'prevention']
        }
      ]);

      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'partial_success');
      expect(response.body.data.tier2_current).toEqual([]);
      expect(response.body.data.tier3_under_review).toEqual([]);
      expect(response.body.data).toHaveProperty('max_similarity', 0);
      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
    });

    it('should base normal-success risk and max similarity on highest approved weighted combined score across tiers', async () => {
      // Reconciliation spec based on authoritative FYP_Selected tier/risk rules.
      // Max-SBERT-only risk is intentionally not used.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 101,
          title: 'Malaria prevention awareness among children',
          keywords: 'malaria prevention children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        }
      ];
      const mockCurrentSessionTopics = [
        {
          id: 202,
          title: 'Malaria control practices in pediatric populations',
          keywords: 'malaria control pediatric',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Balogun',
          category: 'Public Health',
          approved_date: new Date('2026-01-15T10:30:00Z'),
          student_id: 'STU-2024-103',
          embedding: null
        }
      ];
      const mockUnderReviewTopics = [
        {
          id: 303,
          title: 'Prevention strategies for malaria in children',
          keywords: 'prevention malaria children',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Ibrahim',
          category: 'Public Health',
          review_started_at: new Date('2026-01-31T14:45:00Z'),
          reviewing_lecturer: 'Dr. Ibrahim',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce(mockCurrentSessionTopics)
        .mockResolvedValueOnce(mockUnderReviewTopics);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.92, matchedKeywords: ['malaria', 'prevention'] },
        { topicId: 202, title: mockCurrentSessionTopics[0].title, score: 0.95, matchedKeywords: ['malaria'] },
        { topicId: 303, title: mockUnderReviewTopics[0].title, score: 0.94, matchedKeywords: ['malaria', 'children'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.91, matchedTerms: ['malaria', 'prevention'] },
        { topicId: 202, title: mockCurrentSessionTopics[0].title, score: 0.93, matchedTerms: ['malaria'] },
        { topicId: 303, title: mockUnderReviewTopics[0].title, score: 0.92, matchedTerms: ['malaria', 'children'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.49, usedPrecomputed: false },
        { topicId: 202, title: mockCurrentSessionTopics[0].title, score: 0.65, usedPrecomputed: false },
        { topicId: 303, title: mockUnderReviewTopics[0].title, score: 0.64, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.tier1_historical).toHaveLength(1);
      expect(response.body.data.tier2_current).toHaveLength(1);
      expect(response.body.data.tier3_under_review).toHaveLength(1);
      expect(response.body.data).toHaveProperty('max_similarity', 79.4);
      expect(response.body.data).toHaveProperty('overall_risk', 'HIGH');
    });

    it('should expose baseline recommendation text based on normal-success overall risk', async () => {
      // Reconciliation spec based on authoritative FYP_Selected baseline recommendation rules.
      // Tier-specific coordination wording, no-topics, and degraded-mode recommendations are out of scope here.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 101,
          title: 'Malaria prevention awareness among children',
          keywords: 'malaria prevention children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.80, matchedKeywords: ['malaria'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.80, matchedTerms: ['malaria'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.80, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('overall_risk', 'HIGH');
      expect(response.body.data).toHaveProperty(
        'recommendation',
        'High similarity detected. Request topic modification or check with colleagues.'
      );
    });

    it('should include Tier 3 coordination guidance in high-risk normal-success recommendations', async () => {
      // Reconciliation spec based on authoritative FYP_Selected Tier 3 coordination guidance.
      // MEDIUM + Tier 3, degraded mode, and same-lecturer behavior are out of scope here.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockUnderReviewTopics = [
        {
          id: 301,
          title: 'Malaria prevention strategies for children',
          keywords: 'malaria prevention strategies children',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Ibrahim',
          category: 'Public Health',
          review_started_at: new Date('2026-01-31T14:45:00Z'),
          reviewing_lecturer: 'Dr. Ibrahim',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockUnderReviewTopics);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 301, title: mockUnderReviewTopics[0].title, score: 0.85, matchedKeywords: ['malaria'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 301, title: mockUnderReviewTopics[0].title, score: 0.85, matchedTerms: ['malaria'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 301, title: mockUnderReviewTopics[0].title, score: 0.85, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('overall_risk', 'HIGH');
      expect(response.body.data.tier3_under_review).toHaveLength(1);
      expect(response.body.data.tier3_under_review[0]).toHaveProperty('reviewing_lecturer', 'Dr. Ibrahim');
      expect(response.body.data.recommendation).toMatch(/coordinate/i);
      expect(response.body.data.recommendation).toContain('Dr. Ibrahim');
    });

    it('should include Tier 3 coordination guidance in medium-risk normal-success recommendations', async () => {
      // Reconciliation spec based on authoritative FYP_Selected Tier 3 workflow guidance for MEDIUM-range cases.
      // HIGH + Tier 3, degraded mode, and same-lecturer behavior are out of scope here.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockUnderReviewTopics = [
        {
          id: 302,
          title: 'Malaria prevention practices among children',
          keywords: 'malaria prevention practices children',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Okafor',
          category: 'Public Health',
          review_started_at: new Date('2026-01-31T14:45:00Z'),
          reviewing_lecturer: 'Dr. Okafor',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockUnderReviewTopics);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 302, title: mockUnderReviewTopics[0].title, score: 0.60, matchedKeywords: ['malaria'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 302, title: mockUnderReviewTopics[0].title, score: 0.60, matchedTerms: ['malaria'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 302, title: mockUnderReviewTopics[0].title, score: 0.60, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('overall_risk', 'MEDIUM');
      expect(response.body.data.tier3_under_review).toHaveLength(1);
      expect(response.body.data.tier3_under_review[0]).toHaveProperty('reviewing_lecturer', 'Dr. Okafor');
      expect(response.body.data.recommendation).toMatch(/coordinate/i);
      expect(response.body.data.recommendation).toContain('Dr. Okafor');
    });

    it('should order normal-success tier results by approved weighted combined score', async () => {
      // Regression: the old unweighted sum would rank the lexical-heavy topic first.
      // The approved weighted score ranks the semantic-heavy topic first.
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 101,
          title: 'Historical lexical-heavy malaria topic',
          keywords: 'malaria prevention children',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        },
        {
          id: 102,
          title: 'Historical semantic-heavy malaria topic',
          keywords: 'pediatric parasite prevention',
          session_year: '2021/2022',
          supervisor_name: 'Dr. Ogunleye',
          category: 'Health Promotion',
          embedding: null
        }
      ];
      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 1.00, matchedKeywords: ['malaria'] },
        { topicId: 102, title: mockHistoricalTopics[1].title, score: 0.20, matchedKeywords: [] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 1.00, matchedTerms: ['malaria'] },
        { topicId: 102, title: mockHistoricalTopics[1].title, score: 0.20, matchedTerms: [] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.10, usedPrecomputed: false },
        { topicId: 102, title: mockHistoricalTopics[1].title, score: 1.00, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.tier1_historical.map(match => match.id)).toEqual([102, 101]);
      expect(response.body.data.max_similarity).toBe(60);
      expect(response.body.data.overall_risk).toBe('MEDIUM');
    });

    it('should order degraded tier 1 results by approved fallback combined score without fake SBERT', async () => {
      const topic = 'Knowledge of malaria prevention among children under five in Osogbo';
      const mockHistoricalTopics = [
        {
          id: 101,
          title: 'High Jaccard low TF-IDF fallback topic',
          keywords: 'malaria',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Adeyemi',
          category: 'Infectious Diseases',
          embedding: null
        },
        {
          id: 102,
          title: 'Lower Jaccard high TF-IDF fallback topic',
          keywords: 'malaria prevention children',
          session_year: '2021/2022',
          supervisor_name: 'Dr. Ogunleye',
          category: 'Health Promotion',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 1.00, matchedKeywords: ['malaria'] },
        { topicId: 102, title: mockHistoricalTopics[1].title, score: 0.10, matchedKeywords: ['malaria'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 101, title: mockHistoricalTopics[0].title, score: 0.10, matchedTerms: ['malaria'] },
        { topicId: 102, title: mockHistoricalTopics[1].title, score: 0.80, matchedTerms: ['malaria', 'prevention'] }
      ]);

      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'partial_success');
      expect(response.body.data.tier1_historical.map(match => match.id)).toEqual([102, 101]);
      expect(response.body.data.tier1_historical[0]).toHaveProperty('sbert', null);
      expect(response.body.data).toHaveProperty('max_similarity', 52);
      expect(response.body.data).toHaveProperty('overall_risk', 'MEDIUM');
    });

    it('should apply the general 0.10 tier minimum inclusively', async () => {
      const mockHistoricalTopics = [
        {
          id: 1,
          title: 'Exactly eligible fallback topic',
          keywords: 'eligible',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          embedding: null
        },
        {
          id: 2,
          title: 'Below eligible fallback topic',
          keywords: 'below',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: mockHistoricalTopics[0].title, score: 0.25, matchedKeywords: [] },
        { topicId: 2, title: mockHistoricalTopics[1].title, score: 0.247, matchedKeywords: [] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: mockHistoricalTopics[0].title, score: 0, matchedTerms: [] },
        { topicId: 2, title: mockHistoricalTopics[1].title, score: 0, matchedTerms: [] }
      ]);

      sbertService.calculateSbertSimilarities.mockRejectedValue(
        new Error('SBERT service unavailable')
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Eligibility floor topic' });

      expect(response.status).toBe(200);
      expect(response.body.data.tier1_historical.map(match => match.id)).toEqual([1]);
      expect(response.body.data).toHaveProperty('max_similarity', 10);
      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
    });

    it('should require both combined and SBERT thresholds for Tier 2 and Tier 3', async () => {
      const mockCurrentSessionTopics = [
        {
          id: 1,
          title: 'Boundary current topic',
          keywords: 'boundary',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          student_id: 'S1',
          embedding: null
        },
        {
          id: 2,
          title: 'High combined low SBERT current topic',
          keywords: 'combined',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          student_id: 'S2',
          embedding: null
        },
        {
          id: 3,
          title: 'High SBERT low combined current topic',
          keywords: 'sbert',
          session_year: '2025/2026',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          student_id: 'S3',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCurrentSessionTopics)
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: mockCurrentSessionTopics[0].title, score: 0.75, matchedKeywords: [] },
        { topicId: 2, title: mockCurrentSessionTopics[1].title, score: 0.95, matchedKeywords: [] },
        { topicId: 3, title: mockCurrentSessionTopics[2].title, score: 0.30, matchedKeywords: [] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: mockCurrentSessionTopics[0].title, score: 0.50, matchedTerms: [] },
        { topicId: 2, title: mockCurrentSessionTopics[1].title, score: 0.95, matchedTerms: [] },
        { topicId: 3, title: mockCurrentSessionTopics[2].title, score: 0.433333, matchedTerms: [] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 1, title: mockCurrentSessionTopics[0].title, score: 0.60, usedPrecomputed: false },
        { topicId: 2, title: mockCurrentSessionTopics[1].title, score: 0.59, usedPrecomputed: false },
        { topicId: 3, title: mockCurrentSessionTopics[2].title, score: 0.80, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Tier threshold topic' });

      expect(response.status).toBe(200);
      expect(response.body.data.tier2_current.map(match => match.id)).toEqual([1]);
      expect(response.body.data).toHaveProperty('max_similarity', 60);
      expect(response.body.data).toHaveProperty('overall_risk', 'MEDIUM');
    });

    it('should return LOW risk when no candidate reaches the 0.10 tier minimum', async () => {
      const mockHistoricalTopics = [
        {
          id: 1,
          title: 'Very weak historical topic',
          keywords: 'weak',
          session_year: '2022/2023',
          supervisor_name: 'Dr. Test',
          category: 'Public Health',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: mockHistoricalTopics[0].title, score: 0.10, matchedKeywords: [] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: mockHistoricalTopics[0].title, score: 0.10, matchedTerms: [] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 1, title: mockHistoricalTopics[0].title, score: 0.09, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Weak topic' });

      expect(response.status).toBe(200);
      expect(response.body.data.tier1_historical).toEqual([]);
      expect(response.body.data).toHaveProperty('max_similarity', 0);
      expect(response.body.data).toHaveProperty('overall_risk', 'LOW');
    });

    it('should return HIGH risk for current session matches', async () => {
      // Mock database with high similarity current session topic
      const mockCurrentSessionTopics = [
        {
          id: 1,
          title: 'Machine Learning Applications',
          keywords: 'ML, AI',
          session_year: '2024',
          supervisor_name: 'Dr. Smith',
          category: 'AI',
          student_id: 'S12345',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([]) // historical
        .mockResolvedValueOnce(mockCurrentSessionTopics) // current session
        .mockResolvedValueOnce([]); // under review

      // Mock very high similarity scores
      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: 'Machine Learning Applications', score: 0.95, matchedKeywords: ['machin', 'learn', 'applic'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: 'Machine Learning Applications', score: 0.92, matchedTerms: ['machine', 'learning', 'applications'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 1, title: 'Machine Learning Applications', score: 0.98, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Machine Learning Applications' });

      expect(response.status).toBe(200);
      expect(response.body.data.overall_risk).toBe('HIGH');
      expect(response.body.data.tier2_current.length).toBeGreaterThan(0);
    });

    it('should filter tier 1 to top 5 historical topics', async () => {
      // Mock 10 historical topics
      const mockHistoricalTopics = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Historical Topic ${i + 1}`,
        keywords: 'test',
        session_year: '2023',
        supervisor_name: 'Dr. Test',
        category: 'Test',
        embedding: null
      }));

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce(mockHistoricalTopics)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock algorithm results with varying scores
      jaccardService.calculateBatch.mockReturnValue(
        mockHistoricalTopics.map((t, i) => ({
          topicId: t.id,
          title: t.title,
          score: 0.9 - (i * 0.05),
          matchedKeywords: ['test']
        }))
      );

      tfidfService.calculateTfIdfSimilarity.mockReturnValue(
        mockHistoricalTopics.map((t, i) => ({
          topicId: t.id,
          title: t.title,
          score: 0.85 - (i * 0.05),
          matchedTerms: ['test']
        }))
      );

      sbertService.calculateSbertSimilarities.mockResolvedValue(
        mockHistoricalTopics.map((t, i) => ({
          topicId: t.id,
          title: t.title,
          score: 0.88 - (i * 0.05),
          usedPrecomputed: false
        }))
      );

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Test Topic' });

      expect(response.status).toBe(200);
      // Should only return top 5
      expect(response.body.data.tier1_historical).toHaveLength(5);
    });

    it('should only include tier 2 and tier 3 topics with score >= 0.60', async () => {
      // Mock current session topics with varying scores
      const mockCurrentSessionTopics = [
        {
          id: 1,
          title: 'High Similarity Topic',
          keywords: 'test',
          session_year: '2024',
          supervisor_name: 'Dr. Test',
          category: 'Test',
          student_id: 'S1',
          embedding: null
        },
        {
          id: 2,
          title: 'Low Similarity Topic',
          keywords: 'test',
          session_year: '2024',
          supervisor_name: 'Dr. Test',
          category: 'Test',
          student_id: 'S2',
          embedding: null
        }
      ];

      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCurrentSessionTopics)
        .mockResolvedValueOnce([]);

      // Mock scores: one above 0.60, one below
      jaccardService.calculateBatch.mockReturnValue([
        { topicId: 1, title: 'High Similarity Topic', score: 0.70, matchedKeywords: ['test'] },
        { topicId: 2, title: 'Low Similarity Topic', score: 0.30, matchedKeywords: ['test'] }
      ]);

      tfidfService.calculateTfIdfSimilarity.mockReturnValue([
        { topicId: 1, title: 'High Similarity Topic', score: 0.65, matchedTerms: ['test'] },
        { topicId: 2, title: 'Low Similarity Topic', score: 0.25, matchedTerms: ['test'] }
      ]);

      sbertService.calculateSbertSimilarities.mockResolvedValue([
        { topicId: 1, title: 'High Similarity Topic', score: 0.75, usedPrecomputed: false },
        { topicId: 2, title: 'Low Similarity Topic', score: 0.35, usedPrecomputed: false }
      ]);

      const response = await request(app)
        .post('/api/similarity/check')
        .send({ topic: 'Test Topic' });

      expect(response.status).toBe(200);
      // Only topic 1 should be in tier 2 (combined score >= 0.60)
      expect(response.body.data.tier2_current).toHaveLength(1);
      expect(response.body.data.tier2_current[0].id).toBe(1);
    });
  });
});
