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

      <section className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-card">
        <div className="grid gap-0 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)]">
          <aside className="border-b border-emerald-100 bg-[#f6fbf1] p-5 sm:p-6 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              Private checker
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-text-primary">
              Compare an idea before formal review
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              The checker is advisory. It helps you refine a topic without saving a submission or starting a review workflow.
            </p>

            <div className="mt-5 space-y-3">
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

            <div className="mt-5 rounded-[1rem] border border-dashed border-brand-green-light bg-white/75 p-4 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">What happens here</p>
              <ul className="mt-3 space-y-2">
                <li>Enter a topic, category, and keywords.</li>
                <li>Review the advisory similarity result.</li>
                <li>Nothing is attached to your submission history.</li>
              </ul>
            </div>
          </aside>

          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(280px,1.08fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)]">
            <div className="rounded-[1.35rem] border border-border-subtle bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Topic details
                  </p>
                  <h2 className="text-xl font-semibold text-text-primary">Similarity pre-check</h2>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Not saved
                </span>
              </div>
            <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>

            <div className="min-w-0 rounded-[1.35rem] border border-emerald-100 bg-[#fbfdf8] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                    Advisory result
                  </p>
                  <h2 className="text-xl font-semibold text-text-primary">Guidance panel</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
                  No decision action
                </span>
              </div>

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
        </div>
      </section>
    </StudentDashboardLayout>
  );
}

export default CheckMyTopicPage;
