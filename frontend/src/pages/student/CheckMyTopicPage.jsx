import { useRef, useState } from 'react';
import axios from 'axios';
import PageHeader from '../../components/ui/PageHeader';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import SecondaryButton from '../../components/ui/SecondaryButton';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

function mapFypTier1Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.year || '',
    category: match.category || '',
    jaccard_score: match.jaccard || 0,
    tfidf_score: match.tfidf || 0,
    sbert_score: match.sbert || 0,
    combined_similarity_score: match.sbert || match.jaccard || 0
  }));
}

function mapFypTier2Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.approved_date || '',
    jaccard_score: match.jaccard || 0,
    tfidf_score: match.tfidf || 0,
    sbert_score: match.sbert || 0,
    combined_similarity_score: match.sbert || match.jaccard || 0
  }));
}

function mapFypTier3Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.reviewing_lecturer || '',
    session_year: match.review_started_at || '',
    jaccard_score: match.jaccard || 0,
    tfidf_score: match.tfidf || 0,
    sbert_score: match.sbert || 0,
    combined_similarity_score: match.sbert || match.jaccard || 0
  }));
}

function mapLegacyMatches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisorName || '',
    session_year: match.sessionYear || '',
    category: match.category || '',
    jaccard_score: match.scores?.jaccard || 0,
    tfidf_score: match.scores?.tfidf || 0,
    sbert_score: match.scores?.sbert || 0,
    combined_similarity_score: match.scores?.combined || 0
  }));
}

function mapSimilarityResponse(responseData) {
  const fypData = responseData.data;
  const isFypResponse = ['success', 'partial_success'].includes(responseData.status) && fypData;

  if (isFypResponse) {
    return {
      risk_level: fypData.overall_risk || 'LOW',
      max_similarity: fypData.max_similarity ?? 0,
      recommendation: fypData.recommendation,
      sbert_available: responseData.status !== 'partial_success',
      tier1_matches: mapFypTier1Matches(fypData.tier1_historical),
      tier2_matches: mapFypTier2Matches(fypData.tier2_current),
      tier3_matches: mapFypTier3Matches(fypData.tier3_under_review)
    };
  }

  const backendResults = responseData.results || {};
  const maxScore = backendResults.tier1_historical?.length > 0
    ? backendResults.tier1_historical[0].scores?.combined
    : 0;

  return {
    risk_level: responseData.overallRisk || 'LOW',
    max_similarity: responseData.overallMaxSimilarity ?? maxScore,
    sbert_available: responseData.algorithmStatus?.sbert || false,
    tier1_matches: mapLegacyMatches(backendResults.tier1_historical),
    tier2_matches: mapLegacyMatches(backendResults.tier2_current_session),
    tier3_matches: mapLegacyMatches(backendResults.tier3_under_review)
  };
}

function getSimilarityErrorMessage(err) {
  if (err.response) {
    return err.response.data?.message ||
      `Server error (${err.response.status}): ${err.response.statusText}`;
  }

  if (err.request) {
    return 'No response from server. Please check your connection.';
  }

  return err.message || 'An error occurred while checking similarity';
}

function CheckMyTopicPage() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  const handleSubmit = async (data) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await axios.post('/api/similarity/check', data, {
        signal: abortControllerRef.current.signal
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      setResults(mapSimilarityResponse(response.data));
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }

      setError(getSimilarityErrorMessage(err));
      console.error('Student topic similarity check failed:', {
        message: err.message,
        status: err.response?.status,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setError('');
  };

  return (
    <StudentDashboardLayout>
      <PageHeader
        eyebrow="Student portal"
        title="Check My Topic"
        subtitle="Run a private pre-check before deciding whether to submit a topic for lecturer review."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,440px)_1fr]">
        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-emerald-100 bg-white p-5 shadow-card">
            <div className="space-y-4">
              <InfoCallout
                title="Pre-check only"
                message="This check does not submit your topic for lecturer approval, save a result, or create a decision record."
              />
              <InfoCallout
                variant="info"
                title="Final approval remains lecturer-controlled"
                message="Use the feedback to refine your idea. Formal review still happens after you submit a topic."
              />
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-border-subtle bg-white p-4 shadow-card sm:p-5">
            <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </div>

        <div className="min-w-0 rounded-[1.25rem] border border-emerald-100 bg-white/80 p-4 shadow-card sm:p-5">
          {error && !results && (
            <InfoCallout
              variant="danger"
              title="Unable to check topic"
              message={error}
              className="mb-6"
            />
          )}

          {results && (
            <div data-testid="student-results-container" className="animate-fade-in">
              <ResultsDisplay results={results} />
              <div className="pb-4 pt-5 text-center">
                <SecondaryButton type="button" onClick={handleReset} data-testid="reset-button">
                  Check Another Topic
                </SecondaryButton>
              </div>
            </div>
          )}

          {!results && !error && (
            <EmptyStatePanel
              title={isLoading ? 'Checking topic' : 'Awaiting topic check'}
              message={isLoading
                ? 'Your topic is being compared against existing records.'
                : 'Fill out the form to see similarity guidance. Nothing is saved from this pre-check.'}
            />
          )}
        </div>
      </div>
    </StudentDashboardLayout>
  );
}

export default CheckMyTopicPage;
