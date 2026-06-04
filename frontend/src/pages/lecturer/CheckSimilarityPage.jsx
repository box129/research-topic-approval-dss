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
        subtitle="Run a manual advisory check on any research topic without changing a submission, snapshot, or lecturer decision."
      />

      <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-[#f7fbf2] shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
        <div className="border-b border-emerald-100 bg-[linear-gradient(145deg,#f6fbf1,#fffdf7)] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-green">
                Manual checker workspace
              </p>
              <h2 className="mt-1 max-w-4xl whitespace-normal break-keep text-2xl font-semibold tracking-normal text-text-primary hyphens-none [word-spacing:normal]">
                Enter a topic, run the check, then review the advisory evidence.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold hyphens-none" aria-label="Manual checker boundaries">
              <span className="whitespace-nowrap rounded-full border border-emerald-100 bg-white px-3 py-1 text-[#1B5E20] shadow-sm">
                Standalone check
              </span>
              <span className="whitespace-nowrap rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-amber-700">
                No decision write
              </span>
              <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-text-muted shadow-sm">
                No snapshot saved
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6">
          <div className="rounded-[1.35rem] border border-border-subtle border-t-4 border-t-[#1B5E20] bg-white p-4 shadow-sm sm:p-6">
            <TopicForm appearance="lecturer-checker" onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          <div className="rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm leading-6 text-text-secondary shadow-sm">
            <div className="grid gap-3 whitespace-normal break-keep tracking-normal hyphens-none [word-spacing:normal] lg:grid-cols-3">
              <p className="min-w-0 text-left">
                <span className="font-semibold text-[#1B5E20]">Manual check only:</span>{' '}
                this standalone check does not approve, reject, block, or save a topic.
              </p>
              <p className="min-w-0 text-left">
                <span className="font-semibold text-[#1B5E20]">Similarity evidence is advisory:</span>{' '}
                use it to guide review conversations, not to update a submission.
              </p>
              <p className="min-w-0 text-left">
                <span className="font-semibold text-[#1B5E20]">Local result only:</span>{' '}
                the result stays on this screen and no snapshot is saved.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.35rem] border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-green">
                  Similarity results
                </p>
                <h2 className="text-xl font-semibold text-text-primary">Advisory result</h2>
              </div>
              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#1B5E20]">
                No workflow mutation
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
                <ResultsDisplay results={results} appearance="lecturer-checker" />
                <div className="pb-2 pt-5 text-center">
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
                  : 'Fill out the form above to view advisory similarity guidance. Nothing is saved from this standalone check.'}
              />
            )}
          </div>
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default CheckSimilarityPage;
