import { useRef, useState } from 'react';
import axios from 'axios';
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
    <StudentDashboardLayout open>
      <header className="px-1 pt-1 sm:px-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Student portal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#1B5E20] sm:text-4xl">
          Check My Topic
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          Run a quick similarity check before submitting your public health research proposal.
        </p>
      </header>

      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50/65 px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <p className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">Pre-check only</p>
          <div className="text-sm leading-6 text-text-secondary">
            <p>This check does not submit your topic for lecturer approval, save a result, or create a decision record.</p>
            <p className="mt-1">Formal approval remains lecturer-controlled after you submit a topic for review.</p>
          </div>
        </div>
      </aside>

      <section className="rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-2 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">Private checker</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-text-primary">Compare an idea before formal review</h2>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Nothing saved
          </span>
        </div>

        <TopicForm appearance="student-checker" onSubmit={handleSubmit} isLoading={isLoading} />
      </section>

      {error && !results && (
        <InfoCallout
          variant="danger"
          title="Unable to check topic"
          message={error}
        />
      )}

      {!results && !error && (
        <section className="rounded-2xl border border-dashed border-emerald-200 bg-white/75 px-5 py-5 text-center">
          <h2 className="font-serif text-xl font-semibold text-[#1B5E20]">
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
        <section className="animate-fade-in" aria-labelledby="student-results-title">
          <div className="flex flex-col gap-3 border-b border-emerald-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">Advisory result</p>
              <h2 id="student-results-title" className="mt-1 font-serif text-2xl font-semibold text-[#1B5E20]">
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
    </StudentDashboardLayout>
  );
}

export default CheckMyTopicPage;
