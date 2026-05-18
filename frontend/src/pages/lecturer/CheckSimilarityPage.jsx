import { useRef, useState } from 'react';
import axios from 'axios';
import PageHeader from '../../components/ui/PageHeader';
import TopicForm from '../../components/features/TopicInput/TopicForm';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';

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
    <>
      <PageHeader
        title="Check Similarity"
        subtitle="The MVP similarity checker is preserved here as the lecturer standalone checker."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div>
          <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        <div>
          {error && !results && (
            <div className="mb-8 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 shadow-sm" data-testid="error-display">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {results && (
            <div data-testid="results-container" className="animate-fade-in">
              <ResultsDisplay results={results} />
              <div className="pb-8 pt-4 text-center">
                <button
                  type="button"
                  onClick={handleReset}
                  data-testid="reset-button"
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-md transition-colors hover:bg-blue-700"
                >
                  Check Another Topic
                </button>
              </div>
            </div>
          )}

          {!results && !error && (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
              <p className="text-lg font-medium">Awaiting submission</p>
              <p className="mt-2 text-sm">Fill out the form to check topic similarity.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default CheckSimilarityPage;
