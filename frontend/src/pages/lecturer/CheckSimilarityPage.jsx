import { useRef, useState } from 'react';
import { runSimilarityCheck } from '../../api/similarity';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import SecondaryButton from '../../components/ui/SecondaryButton';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

function CheckSimilarityPage() {
  const [results, setResults] = useState(null);
  const [semanticUnavailable, setSemanticUnavailable] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Return contract: true only when a real similarity result succeeds; false
  // on every other path (semantic unavailable, generic failure, cancellation,
  // stale response, invalid format). TopicForm clears its fields only on true,
  // so a failed check can never discard the lecturer's typed proposal.
  const handleSubmit = async (data) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const requestController = new AbortController();
    abortControllerRef.current = requestController;

    setIsLoading(true);
    setError(null);
    setResults(null);
    setSemanticUnavailable(false);

    try {
      const response = await runSimilarityCheck(data, { signal: requestController.signal });

      await new Promise(resolve => setTimeout(resolve, 300));
      if (abortControllerRef.current !== requestController) return false;

      if (response.status === 'semantic_unavailable') {
        setSemanticUnavailable(true);
        return false;
      }

      if (response.status === 'success' && response.semanticAvailable === true) {
        setResults(response.results);
        return true;
      }
      throw new Error('Invalid semantic similarity response format from server');
    } catch (err) {
      if (err.name === 'AbortError') {
        console.info('Similarity check was cancelled');
        return false;
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
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setSemanticUnavailable(false);
    setError(null);
  };

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer tools"
        title="Check Similarity"
        subtitle="Run a manual advisory check on any research topic without changing a submission, snapshot, or lecturer decision."
      />

      <section className="mx-auto w-full max-w-[68rem] space-y-5">
        <InfoCallout
          title="Advisory pre-check"
          message="This check is temporary. It does not save a snapshot or change a submission or lecturer decision."
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <div className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
            <h2 className="mb-4 text-base font-bold text-text-primary">Topic to check</h2>
            <TopicForm appearance="lecturer-checker" onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          <div className="min-w-0 rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
            <h2 className="mb-4 text-base font-bold text-text-primary">Advisory result</h2>

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

            {semanticUnavailable && (
              <div data-testid="semantic-unavailable" className="space-y-4">
                <InfoCallout variant="warning" title="Check could not run" message="Similarity checking is temporarily unavailable. Your topic remains in the form so you can try again." />
                <SecondaryButton type="button" onClick={handleReset} data-testid="reset-button">Check Another Topic</SecondaryButton>
              </div>
            )}

            {!results && !semanticUnavailable && !error && (
              <EmptyStatePanel
                title={isLoading ? 'Checking similarity' : 'Awaiting manual check'}
                message={isLoading
                  ? 'The topic is being compared against existing records.'
                  : 'Fill out the form to view similarity guidance.'}
              />
            )}
          </div>
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default CheckSimilarityPage;
