import { useState } from 'react';
import PropTypes from 'prop-types';

// ============ Constants ============
// Risk level configuration with colors and messaging
const RISK_CONFIGS = {
  LOW: {
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    title: 'Low Risk',
    recommendation: 'Your topic appears unique. You can likely proceed with confidence.'
  },
  MEDIUM: {
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600',
    title: 'Medium Risk',
    recommendation: 'Some overlap detected. Consider reviewing the flagged topics to refine your focus.'
  },
  HIGH: {
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
    title: 'High Risk',
    recommendation: 'Significant overlap detected. We recommend revising your topic to differentiate it.'
  }
};

// Algorithm badge color mapping
const ALGORITHM_BADGE_COLORS = {
  jaccard: 'bg-blue-100 text-blue-800',
  tfidf: 'bg-purple-100 text-purple-800',
  sbert: 'bg-indigo-100 text-indigo-800'
};

// ============ Utility Functions ============
/**
 * Format similarity score as percentage
 */
const formatScore = (score) => {
  if (score === null || score === undefined) return 'N/A';
  return `${Math.round(score)}%`;
};

/**
 * Get algorithm badge color
 */
const getAlgorithmBadgeColor = (algorithm) => {
  return ALGORITHM_BADGE_COLORS[algorithm.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

/**
 * ResultsDisplay Component
 * 
 * Displays similarity check results with risk assessment and tiered matches.
 * Algorithm scores are hidden by default (expandable for advanced users).
 * Tier names are user-friendly: "Similar Past Projects", "Current Session Projects", "Under Review"
 * 
 * @param {Object} props - Component props
 * @param {Object} props.results - Results object from API
 * @param {string} props.results.risk_level - Risk level: LOW, MEDIUM, HIGH
 * @param {number} props.results.max_similarity - Maximum similarity score (0-100)
 * @param {Array} props.results.tier1_matches - Top 5 similar topics (historical)
 * @param {Array} props.results.tier2_matches - Current session matches (≥60%)
 * @param {Array} props.results.tier3_matches - Under review matches (≥60%)
 * @param {boolean} props.results.sbert_available - Whether SBERT scores are available
 */
const ResultsDisplay = ({ results, appearance = 'default' }) => {
  // Track which matches have expanded details
  const [expandedMatches, setExpandedMatches] = useState({});
  const isStudentChecker = appearance === 'student-checker';

  // Risk level configuration
  const riskConfig = RISK_CONFIGS[results.risk_level] || RISK_CONFIGS.LOW;
  const recommendation = results.recommendation || riskConfig.recommendation;

  /**
   * Toggle details visibility for a match
   */
  const toggleDetails = (matchId) => {
    setExpandedMatches(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  /**
   * Get similarity level descriptor (user-friendly)
   */
  const getSimilarityLevel = (score) => {
    if (score >= 75) return { label: 'Very High Match', color: 'text-red-600 font-semibold' };
    if (score >= 60) return { label: 'High Match', color: 'text-orange-600 font-semibold' };
    if (score >= 45) return { label: 'Moderate Match', color: 'text-yellow-600' };
    return { label: 'Low Match', color: 'text-green-600' };
  };

  /**
   * Render a single topic match with expandable algorithm scores
   */
  const renderTopicMatch = (match, index, tierKey) => {
    const matchKey = `${tierKey}-${match.id}-${index}`;
    const isExpanded = expandedMatches[matchKey];
    const score = match.combined_similarity_score || match.jaccard_score || 0;
    const similarityLevel = getSimilarityLevel(score);

    return (
      <div
        key={matchKey}
        data-testid={`topic-match-${index}`}
        className={isStudentChecker
          ? 'rounded-xl border border-emerald-100 bg-white p-4 transition-shadow hover:shadow-md'
          : 'p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow'
        }
      >
        {/* Topic Title */}
        <h4 className="text-lg font-semibold text-gray-900 mb-2" data-testid={`topic-title-${index}`}>
          {match.topic_title}
        </h4>

        {/* Similarity Level (User-Friendly, Prominent) */}
        <div className="mb-3">
          <p className={`text-sm ${similarityLevel.color}`}>
            ⚠ {similarityLevel.label}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 mb-3 text-sm text-gray-600">
          {match.supervisor_name && (
            <span data-testid={`supervisor-${index}`}>
              <strong>Supervisor:</strong> {match.supervisor_name}
            </span>
          )}
          {match.session_year && (
            <span data-testid={`session-${index}`}>
              <strong>Year:</strong> {match.session_year}
            </span>
          )}
          {match.status && (
            <span data-testid={`status-${index}`}>
              <strong>Status:</strong> {match.status}
            </span>
          )}
        </div>

        {/* Expandable Technical Details */}
        <button
          onClick={() => toggleDetails(matchKey)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center transition-colors"
          data-testid={`expand-details-${index}`}
        >
          {isExpanded ? (
            <>
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Hide Technical Details
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Show Technical Details
            </>
          )}
        </button>

        {/* Algorithm Scores (Hidden by Default) */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200" data-testid={`algorithm-details-${index}`}>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Algorithm Scores (Technical)</p>
            <div className="flex flex-wrap gap-2">
              {match.jaccard_score !== undefined && (
                <span
                  data-testid={`jaccard-badge-${index}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getAlgorithmBadgeColor('jaccard')}`}
                  title="Exact token overlap"
                >
                  Exact Match: {formatScore(match.jaccard_score)}
                </span>
              )}
              {match.tfidf_score !== undefined && (
                <span
                  data-testid={`tfidf-badge-${index}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getAlgorithmBadgeColor('tfidf')}`}
                  title="Term importance weighting"
                >
                  Term Weight: {formatScore(match.tfidf_score)}
                </span>
              )}
              {match.sbert_score !== undefined && match.sbert_score !== null && (
                <span
                  data-testid={`sbert-badge-${index}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getAlgorithmBadgeColor('sbert')}`}
                  title="Semantic understanding"
                >
                  Semantic: {formatScore(match.sbert_score)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render tier section with user-friendly naming
   */
  const renderTierSection = (tierKey, tierTitle, tierDescription, matches) => {
    if (!matches || matches.length === 0) return null;

    return (
      <div className={isStudentChecker ? 'mb-6' : 'mb-8'} data-testid={`tier-section-${tierKey}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800" data-testid={`tier-title-${tierKey}`}>
            {tierTitle}
          </h3>
          <span className="inline-block bg-gray-200 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4">{tierDescription}</p>
        <div className={isStudentChecker ? 'grid gap-3 lg:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {matches.map((match, index) => renderTopicMatch(match, index, tierKey))}
        </div>
      </div>
    );
  };

  const totalMatches = (results.tier1_matches?.length || 0) +
    (results.tier2_matches?.length || 0) +
    (results.tier3_matches?.length || 0);

  if (isStudentChecker) {
    return (
      <div className="w-full p-4 sm:p-6" data-testid="results-display">
        <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="rounded-xl border border-emerald-100 bg-[#fbfdf8] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Similarity score</p>
            <p className={`mt-2 text-5xl font-bold ${riskConfig.textColor}`} data-testid="max-similarity">
              {formatScore(results.max_similarity)}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">Highest combined similarity returned by the checker.</p>
            <p className="sr-only" data-testid="summary-max-similarity">{formatScore(results.max_similarity)}</p>
          </div>

          <div
            data-testid="risk-banner"
            data-risk-level={results.risk_level}
            className={`${riskConfig.bgColor} ${riskConfig.borderColor} rounded-xl border p-5`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Advisory risk level</p>
            <h3 className={`mt-2 text-xl font-bold ${riskConfig.textColor}`} data-testid="risk-title">
              {riskConfig.title}
            </h3>
            <p className={`mt-2 text-sm leading-6 ${riskConfig.textColor}`} data-testid="risk-recommendation">
              {recommendation}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/75 px-3 py-1" data-testid="summary-risk">{results.risk_level}</span>
              <span className="rounded-full bg-white/75 px-3 py-1" data-testid="summary-total-matches">
                {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} returned
              </span>
            </div>
          </div>
        </div>

        {!results.sbert_available && (
          <div
            data-testid="sbert-warning"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
          >
            <strong>Partial analysis:</strong> Semantic analysis is temporarily unavailable. Results are based on exact match and term weighting analysis.
          </div>
        )}

        <div className="mt-6">
          {renderTierSection(
            'tier1',
            'Similar Past Projects',
            'The most similar topics from previous submission cycles. Review these to understand how your topic compares.',
            results.tier1_matches
          )}

          {renderTierSection(
            'tier2',
            'Current Session Projects',
            'Topics from current submissions with significant similarity to yours.',
            results.tier2_matches
          )}

          {renderTierSection(
            'tier3',
            'Under Review Projects',
            'Recently submitted topics under review that show some overlap with your submission.',
            results.tier3_matches
          )}

          {totalMatches === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center" data-testid="no-matches">
              <p className="font-medium text-[#1B5E20]">No similar topics found. Your topic appears unique.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6" data-testid="results-display">
      {/* Risk Assessment Banner */}
      <div
        data-testid="risk-banner"
        data-risk-level={results.risk_level}
        className={`${riskConfig.bgColor} ${riskConfig.borderColor} border-l-4 p-6 rounded-lg mb-8`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className={`h-6 w-6 ${riskConfig.iconColor}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              data-testid="risk-icon"
            >
              {results.risk_level === 'HIGH' ? (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              ) : results.risk_level === 'MEDIUM' ? (
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              )}
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-lg font-bold ${riskConfig.textColor}`} data-testid="risk-title">
              {riskConfig.title}
            </h3>
            <p className={`mt-2 text-sm ${riskConfig.textColor}`} data-testid="risk-recommendation">
              {recommendation}
            </p>
            <p className={`mt-3 text-sm font-semibold ${riskConfig.textColor}`} data-testid="max-similarity">
              Maximum Similarity Score: {formatScore(results.max_similarity)}
            </p>
          </div>
        </div>
      </div>

      {/* SBERT Degradation Notice */}
      {!results.sbert_available && (
        <div
          data-testid="sbert-warning"
          className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Semantic analysis is temporarily unavailable. Results are based on exact match and term weighting analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Overview Cards */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Similarity Analysis Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Risk Level</p>
            <p className={`text-2xl font-bold ${riskConfig.textColor}`} data-testid="summary-risk">
              {results.risk_level}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Highest Similarity</p>
            <p className="text-2xl font-bold text-gray-900" data-testid="summary-max-similarity">
              {formatScore(results.max_similarity)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Total Matches Found</p>
            <p className="text-2xl font-bold text-gray-900" data-testid="summary-total-matches">
              {(results.tier1_matches?.length || 0) + 
               (results.tier2_matches?.length || 0) + 
               (results.tier3_matches?.length || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Tier 1: Similar Past Projects (Historical Top 5) */}
      {renderTierSection(
        'tier1',
        '📚 Similar Past Projects',
        'The 5 most similar topics from previous submission cycles. Review these to understand how your topic compares.',
        results.tier1_matches
      )}

      {/* Tier 2: Current Session Projects */}
      {renderTierSection(
        'tier2',
        '📝 Current Session Projects',
        'Topics from current submissions with significant similarity to yours. These may be competing proposals.',
        results.tier2_matches
      )}

      {/* Tier 3: Under Review Projects */}
      {renderTierSection(
        'tier3',
        '⏳ Under Review Projects',
        'Recently submitted topics under review that show some overlap with your submission.',
        results.tier3_matches
      )}

      {/* No Matches Message */}
      {(!results.tier1_matches || results.tier1_matches.length === 0) && 
       (!results.tier2_matches || results.tier2_matches.length === 0) && 
       (!results.tier3_matches || results.tier3_matches.length === 0) && (
        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200" data-testid="no-matches">
          <svg className="mx-auto h-12 w-12 text-green-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-green-800 font-medium">No similar topics found. Your topic appears unique!</p>
        </div>
      )}
    </div>
  );
};

// ============ PropTypes Definition ============
const MATCH_SHAPE = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  topic_title: PropTypes.string.isRequired,
  supervisor_name: PropTypes.string,
  session_year: PropTypes.string,
  status: PropTypes.string,
  jaccard_score: PropTypes.number,
  tfidf_score: PropTypes.number,
  sbert_score: PropTypes.number,
  combined_similarity_score: PropTypes.number
});

ResultsDisplay.propTypes = {
  results: PropTypes.shape({
    risk_level: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH']).isRequired,
    max_similarity: PropTypes.number.isRequired,
    recommendation: PropTypes.string,
    tier1_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier2_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier3_matches: PropTypes.arrayOf(MATCH_SHAPE),
    sbert_available: PropTypes.bool.isRequired
  }).isRequired,
  appearance: PropTypes.oneOf(['default', 'student-checker'])
};

export default ResultsDisplay;
