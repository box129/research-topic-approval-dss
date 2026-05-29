import { useRef, useState } from 'react';
import axios from 'axios';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import SecondaryButton from '../../components/ui/SecondaryButton';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

function CheckSimilarityPage() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const handleSubmit = async (data) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post('/api/similarity/check', data, {
        signal: abortControllerRef.current.signal
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const fypData = response.data.data;
      const isFypResponse = ['success', 'partial_success'].includes(response.data.status) && fypData;

      const mapFypTier1Matches = (matches = []) => matches.map(m => ({
        id: m.id,
        topic_title: m.title || '',
        supervisor_name: m.supervisor || '',
        session_year: m.year || '',
        category: m.category || '',
        jaccard_score: m.jaccard || 0,
        tfidf_score: m.tfidf || 0,
        sbert_score: m.sbert || 0,
        combined_similarity_score: m.sbert || m.jaccard || 0
      }));

      const mapFypTier2Matches = (matches = []) => matches.map(m => ({
        id: m.id,
        topic_title: m.title || '',
        supervisor_name: m.supervisor || '',
        session_year: m.approved_date || '',
        jaccard_score: m.jaccard || 0,
        tfidf_score: m.tfidf || 0,
        sbert_score: m.sbert || 0,
        combined_similarity_score: m.sbert || m.jaccard || 0
      }));

      const mapFypTier3Matches = (matches = []) => matches.map(m => ({
        id: m.id,
        topic_title: m.title || '',
        supervisor_name: m.reviewing_lecturer || '',
        session_year: m.review_started_at || '',
        jaccard_score: m.jaccard || 0,
        tfidf_score: m.tfidf || 0,
        sbert_score: m.sbert || 0,
        combined_similarity_score: m.sbert || m.jaccard || 0
      }));

      const mapLegacyMatches = (matches = []) => matches.map(m => ({
        id: m.id,
        topic_title: m.title || '',
        supervisor_name: m.supervisorName || '',
        session_year: m.sessionYear || '',
        category: m.category || '',
        jaccard_score: m.scores?.jaccard || 0,
        tfidf_score: m.scores?.tfidf || 0,
        sbert_score: m.scores?.sbert || 0,
        combined_similarity_score: m.scores?.combined || 0
      }));

      const backendResults = response.data.results || {};
      const maxScore = backendResults.tier1_historical?.length > 0
        ? backendResults.tier1_historical[0].scores?.combined
        : 0;

      const mappedResults = isFypResponse ? {
        risk_level: fypData.overall_risk || 'LOW',
        max_similarity: fypData.max_similarity ?? 0,
        recommendation: fypData.recommendation,
        sbert_available: response.data.status !== 'partial_success',
        tier1_matches: mapFypTier1Matches(fypData.tier1_historical),
        tier2_matches: mapFypTier2Matches(fypData.tier2_current),
        tier3_matches: mapFypTier3Matches(fypData.tier3_under_review)
      } : {
        risk_level: response.data.overallRisk || 'LOW',
        max_similarity: response.data.overallMaxSimilarity ?? maxScore,
        sbert_available: response.data.algorithmStatus?.sbert || false,
        tier1_matches: mapLegacyMatches(backendResults.tier1_historical),
        tier2_matches: mapLegacyMatches(backendResults.tier2_current_session),
        tier3_matches: mapLegacyMatches(backendResults.tier3_under_review)
      };

      setResults(mappedResults);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.info('Similarity check was cancelled');
        return;
      }

      let errorMessage = 'An error occurred while checking similarity';

      if (err.response) {
        errorMessage = err.response.data?.message ||
          `Server error (${err.response.status}): ${err.response.statusText}`;
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      console.error('Similarity check failed:', {
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
    setError(null);
  };

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer tools"
        title="Check Similarity"
        subtitle="Run an advisory manual similarity check without changing a submission, snapshot, or lecturer decision."
      />

      <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(320px,0.38fr)_minmax(0,0.62fr)]">
          <aside className="border-b border-emerald-100 bg-[#f6fbf1] p-5 sm:p-7 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              Advisory workspace
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-text-primary">
              Run a standalone topic comparison
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              This page supports manual review conversations without starting or changing any submission workflow.
            </p>

            <div className="mt-5 space-y-3">
              <InfoCallout
                title="Manual check only"
                message="This standalone check uses the general similarity endpoint and does not approve, reject, block, or save a topic."
              />
              <InfoCallout
                variant="info"
                title="Similarity evidence is advisory"
                message="Use the result to guide a discussion or review. Formal decisions remain on the submission detail workflow."
              />
            </div>

            <div className="mt-5 rounded-[1.15rem] border border-dashed border-brand-green-light bg-white/75 p-4 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">What stays unchanged</p>
              <ul className="mt-3 space-y-2">
                <li>The same public similarity endpoint is used.</li>
                <li>The result is local to this screen.</li>
                <li>No snapshot or lecturer decision is created.</li>
              </ul>
            </div>
          </aside>

          <div className="grid gap-5 p-4 sm:p-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
            <div className="rounded-[1.35rem] border border-border-subtle bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Topic input
                  </p>
                  <h2 className="text-xl font-semibold text-text-primary">Manual review form</h2>
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
                    Similarity output
                  </p>
                  <h2 className="text-xl font-semibold text-text-primary">Advisory result area</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
                  No status update
                </span>
              </div>

              {error && !results && (
                <div data-testid="error-display" className="mb-6">
                  <InfoCallout
                    variant="danger"
                    title="Unable to check similarity"
                    message={error}
                  />
                </div>
              )}

              {results && (
                <div data-testid="results-container" className="animate-fade-in">
                  <ResultsDisplay results={results} />
                  <div className="pb-4 pt-5 text-center">
                    <SecondaryButton
                      type="button"
                      onClick={handleReset}
                      data-testid="reset-button"
                    >
                      Check Another Topic
                    </SecondaryButton>
                  </div>
                </div>
              )}

              {!results && !error && (
                <EmptyStatePanel
                  title={isLoading ? 'Checking similarity' : 'Awaiting manual check'}
                  message={isLoading
                    ? 'The topic is being compared against existing records. No submission status will change.'
                    : 'Fill out the form to view advisory similarity guidance. Nothing is saved from this standalone check.'}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default CheckSimilarityPage;
