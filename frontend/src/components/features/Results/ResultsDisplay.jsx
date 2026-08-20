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
    recommendation: 'No high-similarity records were identified by this check. Review the proposal and its context before making a submission or approval decision.'
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

// Rendered when the backend returned no risk classification (risk_level null),
// which happens when no eligible stored topics were available for comparison.
// An empty corpus must never be presented as a LOW-risk or "unique" result.
const NO_CLASSIFICATION_CONFIG = {
  color: 'gray',
  bgColor: 'bg-gray-50',
  borderColor: 'border-gray-400',
  textColor: 'text-gray-800',
  iconColor: 'text-gray-500',
  title: 'No Risk Classification',
  recommendation: 'No eligible stored topics are currently available for comparison. This result does not establish that the topic is new or original.'
};

// ============ Utility Functions ============
/**
 * Format the raw directional semantic cosine score.
 */
const formatScore = (score) => {
  if (score === null || score === undefined) return 'N/A';
  return Number(score).toFixed(3);
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
 * @param {boolean} props.results.semantic_available - Whether semantic scores are available
 */
const ResultsDisplay = ({ results, appearance = 'default' }) => {
  // Track which matches have expanded details
  const [expandedMatches, setExpandedMatches] = useState({});
  const isCheckerShell = ['student-checker', 'lecturer-checker'].includes(appearance);
  const isStudentChecker = appearance === 'student-checker';

  // Risk level configuration; a null risk level means the backend made no
  // classification (empty comparison corpus) and must not fall back to LOW.
  const riskConfig = RISK_CONFIGS[results.risk_level] || NO_CLASSIFICATION_CONFIG;
  const riskLabel = results.risk_level || 'NOT CLASSIFIED';
  const recommendation = results.recommendation || (isStudentChecker && results.risk_level === 'LOW'
    ? 'No high-similarity records were identified by this check. Review the proposal and its context before making a submission or approval decision.'
    : riskConfig.recommendation);

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
    if (score >= 0.8) return { label: 'Very High Match', color: 'text-red-600 font-semibold' };
    if (score >= 0.7) return { label: 'High Match', color: 'text-orange-600 font-semibold' };
    if (score >= 0.6) return { label: 'Moderate Match', color: 'text-yellow-600' };
    return { label: 'Low Match', color: 'text-green-600' };
  };

  /**
   * Render a single topic match with expandable algorithm scores
   */
  const renderTopicMatch = (match, index, tierKey) => {
    const matchKey = `${match.collection}-${match.id}-${index}`;
    const isExpanded = expandedMatches[matchKey];
    const score = match.semantic_score;
    const similarityLevel = getSimilarityLevel(score);
    const studentMetadata = tierKey === 'tier3'
      ? [
          ['Reviewing lecturer', match.supervisor_name, `supervisor-${index}`],
          ['Review started', match.session_year, `session-${index}`]
        ]
      : tierKey === 'tier2'
        ? [
            ['Supervisor', match.supervisor_name, `supervisor-${index}`],
            ['Approved date', match.session_year, `session-${index}`]
          ]
        : [
            ['Supervisor', match.supervisor_name, `supervisor-${index}`],
            ['Session', match.session_year, `session-${index}`]
          ];

    return (
      <div
        key={matchKey}
        data-testid={`topic-match-${index}`}
        className={isCheckerShell
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
          {isStudentChecker ? studentMetadata.map(([label, value, testId]) => value && (
            <span key={label} data-testid={testId}><strong>{label}:</strong> {value}</span>
          )) : <>
            {match.supervisor_name && <span data-testid={`supervisor-${index}`}><strong>Supervisor:</strong> {match.supervisor_name}</span>}
            {match.session_year && <span data-testid={`session-${index}`}><strong>Year:</strong> {match.session_year}</span>}
          </>}
          {match.status && (
            <span data-testid={`status-${index}`}>
              <strong>Status:</strong> {match.status}
            </span>
          )}
        </div>

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

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200" data-testid={`algorithm-details-${index}`}>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Semantic similarity</p>
            <div className="flex flex-wrap gap-2">
              <span data-testid={`semantic-badge-${index}`} className="px-3 py-1 rounded-full text-xs font-medium text-blue-700 bg-blue-50">Semantic: {formatScore(match.semantic_score)}</span>
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
      <div className={isCheckerShell ? 'mb-6' : 'mb-8'} data-testid={`tier-section-${tierKey}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800" data-testid={`tier-title-${tierKey}`}>
            {tierTitle}
          </h3>
          <span className="inline-block bg-gray-200 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4">{tierDescription}</p>
        <div className={isCheckerShell ? 'grid gap-3 lg:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {matches.map((match, index) => renderTopicMatch(match, index, tierKey))}
        </div>
      </div>
    );
  };

  const totalMatches = (results.tier1_matches?.length || 0) +
    (results.tier2_matches?.length || 0) +
    (results.tier3_matches?.length || 0);

  if (isCheckerShell) {
    return (
      <div className="w-full p-4 sm:p-6" data-testid="results-display">
        <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="rounded-xl border border-emerald-100 bg-[#fbfdf8] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Similarity score</p>
            <p className={`mt-2 text-5xl font-bold ${riskConfig.textColor}`} data-testid="max-similarity">
              {formatScore(results.max_similarity)}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">Highest semantic similarity returned by the checker.</p>
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
              <span className="rounded-full bg-white/75 px-3 py-1" data-testid="summary-risk">{riskLabel}</span>
              <span className="rounded-full bg-white/75 px-3 py-1" data-testid="summary-total-matches">
                {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} returned
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {renderTierSection(
            'tier1',
            isStudentChecker ? 'Historical topics' : 'Similar Past Projects',
            'The most similar topics from previous submission cycles. Review these to understand how your topic compares.',
            results.tier1_matches
          )}

          {renderTierSection(
            'tier2',
            isStudentChecker ? 'Current-session topics' : 'Current Session Projects',
            'Topics from current submissions with significant similarity to yours.',
            results.tier2_matches
          )}

          {renderTierSection(
            'tier3',
            isStudentChecker ? 'Under-review topics' : 'Under Review Projects',
            'Recently submitted topics under review that show some overlap with your submission.',
            results.tier3_matches
          )}

          {totalMatches === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center" data-testid="no-matches">
              <p className="font-medium text-[#1B5E20]">No meaningful matches were returned by this check.</p>
              <p className="mt-2 text-sm text-text-secondary">This does not establish originality or guarantee approval. Review the proposal and its context before deciding whether to submit it.</p>
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
              ) : results.risk_level === 'LOW' ? (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
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
              Maximum Semantic Similarity: {formatScore(results.max_similarity)}
            </p>
          </div>
        </div>
      </div>

      {/* Results Overview Cards */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Similarity Analysis Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Risk Level</p>
            <p className={`text-2xl font-bold ${riskConfig.textColor}`} data-testid="summary-risk">
              {riskLabel}
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

      {/* No Matches Message — must not claim originality: zero matches usually
          means no eligible stored topics were available for comparison. */}
      {(!results.tier1_matches || results.tier1_matches.length === 0) &&
       (!results.tier2_matches || results.tier2_matches.length === 0) &&
       (!results.tier3_matches || results.tier3_matches.length === 0) && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200" data-testid="no-matches">
          <p className="text-gray-800 font-medium">
            {results.corpus_size === 0
              ? 'No eligible stored topics are currently available for comparison.'
              : 'No matching topics were returned by this check.'}
          </p>
          <p className="mt-2 text-sm text-gray-600">This does not establish originality or guarantee approval. Review the proposal and its context before deciding how to proceed.</p>
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
  collection: PropTypes.oneOf(['HISTORICAL', 'CURRENT_SESSION', 'UNDER_REVIEW']).isRequired,
  semantic_score: PropTypes.number.isRequired,
  similarity_class: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH'])
});

ResultsDisplay.propTypes = {
  results: PropTypes.shape({
    // null when the backend made no classification (empty comparison corpus).
    risk_level: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH']),
    max_similarity: PropTypes.number,
    corpus_size: PropTypes.number,
    recommendation: PropTypes.string,
    tier1_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier2_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier3_matches: PropTypes.arrayOf(MATCH_SHAPE),
    semantic_available: PropTypes.bool
  }).isRequired,
  appearance: PropTypes.oneOf(['default', 'student-checker', 'lecturer-checker'])
};

export default ResultsDisplay;
