import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { runSimilarityCheck } from '../../api/similarity';
import InfoCallout from '../../components/ui/InfoCallout';
import SecondaryButton from '../../components/ui/SecondaryButton';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import SimilarityCheckUnavailable from '../../components/features/Results/SimilarityCheckUnavailable';

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
  // Boolean only: the C2 surface is frontend-authored product language, so the
  // backend failure message is detection input and is never rendered here.
  const [semanticUnavailable, setSemanticUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedProposal, setCheckedProposal] = useState(null);
  const abortControllerRef = useRef(null);
  const topicInputRef = useRef(null);
  const errorAlertRef = useRef(null);
  const unavailableRef = useRef(null);
  const [focusFreshForm, setFocusFreshForm] = useState(false);

  const handleSubmit = async (data) => {
    abortControllerRef.current?.abort();
    const requestController = new AbortController();
    abortControllerRef.current = requestController;

    setIsLoading(true);
    setError('');
    setResults(null);
    setSemanticUnavailable(false);
    setCheckedProposal(data);

    try {
      const response = await runSimilarityCheck(data, { signal: requestController.signal });
      if (abortControllerRef.current !== requestController) return false;
      if (response.status === 'semantic_unavailable') {
        // The check did not run, so the input was not consumed: returning
        // false keeps TopicForm from clearing the typed proposal.
        setSemanticUnavailable(true);
        return false;
      }
      setResults(response.results);
      return true;
    } catch (err) {
      if (requestController.signal.aborted || err.name === 'AbortError' || err.name === 'CanceledError' || axios.isCancel?.(err)) return false;
      if (abortControllerRef.current !== requestController) return false;

      setError(getSimilarityErrorMessage(err));
      return false;
    } finally {
      if (abortControllerRef.current === requestController) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const handleReset = () => {
    setResults(null);
    setSemanticUnavailable(false);
    setError('');
    setCheckedProposal(null);
    setFocusFreshForm(true);
  };

  // C2 recovery: retry repeats the failed check with the identical retained
  // proposal; edit returns to the form seeded from that proposal. Neither
  // resets the workflow and neither discards the student's work.
  const handleRetry = () => {
    if (checkedProposal) handleSubmit(checkedProposal);
  };

  const handleEditProposal = () => {
    setSemanticUnavailable(false);
    setFocusFreshForm(true);
  };

  useEffect(() => {
    if (!semanticUnavailable) return undefined;

    const animationFrame = requestAnimationFrame(() => unavailableRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [semanticUnavailable]);

  useEffect(() => {
    if (!focusFreshForm || results) return undefined;

    const animationFrame = requestAnimationFrame(() => {
      topicInputRef.current?.focus();
      setFocusFreshForm(false);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [focusFreshForm, results]);

  useEffect(() => {
    if (!error) return undefined;

    const animationFrame = requestAnimationFrame(() => errorAlertRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [error]);

  return (
    <div className="space-y-5">
      <header className="grid gap-2 border-b border-gray-200 pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-green-dark">Student · Topic workflow</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-brand-green-dark sm:text-4xl">
          Check My Topic
        </h1></div>
        <p className="max-w-3xl text-sm leading-6 text-text-secondary lg:text-base">
          Compare a proposed topic with stored research-topic records before deciding whether to submit it for lecturer review.
        </p>
      </header>

      <aside aria-label="Advisory boundary" className="border-l-4 border-blue-600 bg-blue-50 px-4 py-3 sm:px-5">
        <p className="font-bold text-blue-950">Advisory pre-check</p>
        <p className="mt-1 text-sm leading-6 text-blue-950">This private pre-check does not save or submit your topic. Similarity evidence supports your judgement but does not approve or reject a proposal.</p>
      </aside>

      {error && !results && (
        <div ref={errorAlertRef} role="alert" tabIndex="-1" className="focus:outline-none">
          <InfoCallout role={null} variant="danger" title="Unable to check topic" message={error} />
        </div>
      )}

      {isLoading && (
        <section aria-live="polite" className="flex flex-col gap-4 border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center">
          <span aria-hidden="true" className="h-7 w-7 shrink-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700 motion-reduce:animate-none" />
          <div className="flex-1"><h2 className="text-lg font-bold text-blue-950">Checking similarity</h2><p className="mt-1 text-sm text-blue-900">Checking the proposed topic against supported research-topic records.</p></div>
          <button type="button" disabled className="min-h-11 rounded-md bg-gray-400 px-5 font-bold text-white">Checking Similarity</button>
        </section>
      )}

      {!results && !semanticUnavailable && (
        <section className={`${error ? 'block' : 'grid lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]'} gap-6 border border-gray-200 bg-white p-4 shadow-sm sm:p-6`}>
          <TopicForm appearance="student-checker" onSubmit={handleSubmit} isLoading={isLoading} compact={isLoading || Boolean(error)} topicInputRef={topicInputRef} initialValues={checkedProposal} />
          {!error && <aside aria-labelledby="check-context-title" className="border-t border-gray-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h2 id="check-context-title" className="text-lg font-bold text-text-primary">What this check considers</h2>
            <dl className="mt-4 space-y-4 text-sm"><div><dt className="font-bold">Semantic topic representation</dt><dd className="mt-1 text-text-secondary">The title, population, location, and study focus when supplied.</dd></div><div><dt className="font-bold">Stored research-topic records</dt><dd className="mt-1 text-text-secondary">The most similar eligible records are returned for advisory review.</dd></div></dl>
            <p className="mt-5 border-t border-gray-200 pt-4 text-sm text-text-secondary">The result is evidence for review, not an academic decision.</p>
          </aside>}
        </section>
      )}

      {semanticUnavailable && (
        <section
          ref={unavailableRef}
          tabIndex="-1"
          role="alert"
          data-testid="semantic-unavailable"
          className="focus:outline-none"
        >
          <SimilarityCheckUnavailable proposal={checkedProposal} onRetry={handleRetry} onEdit={handleEditProposal} />
        </section>
      )}

      {results && (
        <section className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-labelledby="student-results-title">
          <section aria-labelledby="checked-proposal-title" className="border border-gray-200 bg-white px-5 py-4">
            <h2 id="checked-proposal-title" className="text-lg font-bold text-brand-green-dark">Checked proposal</h2>
            <p className="mt-2 font-semibold text-text-primary">{checkedProposal?.topic}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-bold">Population</dt><dd>{checkedProposal?.population || 'Not specified'}</dd></div><div><dt className="font-bold">Location</dt><dd>{checkedProposal?.location || 'Not specified'}</dd></div><div><dt className="font-bold">Study focus</dt><dd>{checkedProposal?.studyFocus || 'Not specified'}</dd></div></dl>
            <p className="mt-3 text-sm text-text-secondary">Temporary browser state only. This proposal was not saved or submitted.</p>
          </section>
          {/* Board A: similarity evidence rests neutral — the result boundary
              and wrapper never carry the approval/action hue. */}
          <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-green-dark">Advisory result</p>
              <h2 id="student-results-title" className="mt-1 font-serif text-2xl font-semibold text-brand-green-dark">
                Your results
              </h2>
            </div>
            <SecondaryButton type="button" onClick={handleReset} data-testid="reset-button">
              Check Another Topic
            </SecondaryButton>
          </div>

          <div data-testid="student-results-container" className="mt-3 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <ResultsDisplay results={results} appearance="student-checker" />
          </div>
        </section>
      )}
    </div>
  );
}

export default CheckMyTopicPage;
