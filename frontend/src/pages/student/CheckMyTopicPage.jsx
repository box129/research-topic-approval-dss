import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import InfoCallout from '../../components/ui/InfoCallout';
import SecondaryButton from '../../components/ui/SecondaryButton';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';

function mapFypTier1Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.year || '',
    category: match.category || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert ?? null
  }));
}

function mapFypTier2Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.supervisor || '',
    session_year: match.approved_date || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert ?? null
  }));
}

function mapFypTier3Matches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    topic_title: match.title || '',
    supervisor_name: match.reviewing_lecturer || '',
    session_year: match.review_started_at || '',
    jaccard_score: match.jaccard ?? 0,
    tfidf_score: match.tfidf ?? 0,
    sbert_score: match.sbert ?? null
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
  const [checkedProposal, setCheckedProposal] = useState(null);
  const abortControllerRef = useRef(null);
  const topicInputRef = useRef(null);
  const errorAlertRef = useRef(null);
  const [focusFreshForm, setFocusFreshForm] = useState(false);

  const handleSubmit = async (data) => {
    abortControllerRef.current?.abort();
    const requestController = new AbortController();
    abortControllerRef.current = requestController;

    setIsLoading(true);
    setError('');
    setResults(null);
    setCheckedProposal(data);

    try {
      const response = await axios.post('/api/similarity/check', data, {
        signal: requestController.signal
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      if (abortControllerRef.current !== requestController) return false;

      setResults(mapSimilarityResponse(response.data));
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
    setError('');
    setCheckedProposal(null);
    setFocusFreshForm(true);
  };

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
          <InfoCallout variant="danger" title="Unable to check topic" message={error} />
        </div>
      )}

      {isLoading && (
        <section aria-live="polite" className="flex flex-col gap-4 border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center">
          <span aria-hidden="true" className="h-7 w-7 shrink-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700 motion-reduce:animate-none" />
          <div className="flex-1"><h2 className="text-lg font-bold text-blue-950">Checking similarity</h2><p className="mt-1 text-sm text-blue-900">Checking the proposed topic against supported research-topic records.</p></div>
          <button type="button" disabled className="min-h-11 rounded-md bg-gray-400 px-5 font-bold text-white">Checking Similarity</button>
        </section>
      )}

      {!results && (
        <section className={`${error ? 'block' : 'grid lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]'} gap-6 border border-gray-200 bg-white p-4 shadow-sm sm:p-6`}>
          <TopicForm appearance="student-checker" onSubmit={handleSubmit} isLoading={isLoading} compact={isLoading || Boolean(error)} topicInputRef={topicInputRef} />
          {!error && <aside aria-labelledby="check-context-title" className="border-t border-gray-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h2 id="check-context-title" className="text-lg font-bold text-brand-green-dark">What this check considers</h2>
            <dl className="mt-4 space-y-4 text-sm"><div><dt className="font-bold">Exact overlap</dt><dd className="mt-1 text-text-secondary">Shared words and phrases.</dd></div><div><dt className="font-bold">Weighted terms</dt><dd className="mt-1 text-text-secondary">The relative importance of terms.</dd></div><div><dt className="font-bold">Semantic meaning</dt><dd className="mt-1 text-text-secondary">Conceptual similarity when the semantic service is available.</dd></div></dl>
            <p className="mt-5 border-t border-gray-200 pt-4 text-sm text-text-secondary">The result is evidence for review, not an academic decision.</p>
          </aside>}
        </section>
      )}

      {!results && !error && !isLoading && (
        <section className="rounded-2xl border border-dashed border-emerald-200 bg-white/75 px-5 py-5 text-center">
          <h2 className="font-serif text-xl font-semibold text-brand-green-dark">
            {isLoading ? 'Checking topic' : 'Awaiting topic check'}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {isLoading
              ? 'Your topic is being compared against existing records.'
              : 'Complete the form to view advisory similarity guidance. Nothing is saved from this pre-check.'}
          </p>
        </section>
      )}

      {results && (
        <section className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-labelledby="student-results-title">
          <section aria-labelledby="checked-proposal-title" className="border border-gray-200 bg-white px-5 py-4">
            <h2 id="checked-proposal-title" className="text-lg font-bold text-brand-green-dark">Checked proposal</h2>
            <p className="mt-2 font-semibold text-text-primary">{checkedProposal?.topic}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-bold">Research area</dt><dd>{checkedProposal?.category || 'Not specified'}</dd></div><div><dt className="font-bold">Keywords</dt><dd>{checkedProposal?.keywords || 'Not specified'}</dd></div></dl>
            <p className="mt-3 text-sm text-text-secondary">Temporary browser state only. This proposal was not saved or submitted.</p>
          </section>
          <div className="flex flex-col gap-3 border-b border-emerald-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
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

          <div data-testid="student-results-container" className="mt-3 rounded-2xl border border-emerald-100 bg-white/95 shadow-sm">
            <ResultsDisplay results={results} appearance="student-checker" />
          </div>
        </section>
      )}
    </div>
  );
}

export default CheckMyTopicPage;
