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

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="space-y-4">
          <InfoCallout
            title="Manual check only"
            message="This standalone check uses the general similarity endpoint and does not approve, reject, block, or save a topic."
          />
          <InfoCallout
            variant="info"
            title="Similarity evidence is advisory"
            message="Use the result to guide a discussion or review. Formal decisions remain on the submission detail workflow."
          />
          <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        <div>
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
              <div className="pb-8 pt-4 text-center">
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
    </LecturerDashboardLayout>
  );
}

export default CheckSimilarityPage;
