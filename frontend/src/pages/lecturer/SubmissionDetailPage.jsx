import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import { runLecturerSubmissionSimilarityCheck } from '../../api/similarity';
import {
  getLecturerSubmission,
  updateLecturerSubmissionStatus
} from '../../api/submissions';

function formatDate(value) {
  if (!value) {
    return 'Not submitted';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || 'Not provided'}</dd>
    </div>
  );
}

function SubmissionDetailPage() {
  const { topicId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [similarityResults, setSimilarityResults] = useState(null);
  const [similarityStatus, setSimilarityStatus] = useState('');
  const [similarityNotice, setSimilarityNotice] = useState('');
  const [similarityError, setSimilarityError] = useState('');
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);

  const loadSubmission = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setSubmission(await getLecturerSubmission(topicId));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load submission details.');
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  const handleStatusUpdate = async (status, confirmLabel, successLabel) => {
    const confirmed = window.confirm(`${confirmLabel} this submission?`);
    if (!confirmed) {
      return;
    }

    setIsUpdating(true);
    setError('');
    setSuccessMessage('');

    try {
      const updatedSubmission = await updateLecturerSubmissionStatus(topicId, status);
      setSubmission(updatedSubmission);
      setSuccessMessage(`Submission ${successLabel} successfully.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update submission status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSimilarityCheck = async () => {
    if (!submission?.id) {
      setSimilarityError('Submission id is required before running a similarity check.');
      return;
    }

    setIsCheckingSimilarity(true);
    setSimilarityError('');
    setSimilarityNotice('');
    setSimilarityStatus('');
    setSimilarityResults(null);

    try {
      const response = await runLecturerSubmissionSimilarityCheck(submission.id);

      setSimilarityStatus(response.status);
      setSimilarityNotice(response.message || '');
      setSimilarityResults(response.results);
    } catch (err) {
      setSimilarityError(err.response?.data?.message || err.message || 'Unable to run similarity check.');
    } finally {
      setIsCheckingSimilarity(false);
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const canUpdateStatus = submission?.status === 'pending_review';

  return (
    <>
      <PageHeader
        title="Submission Details"
        subtitle="Review a student's submitted topic before making a basic status decision."
      />

      <div className="mb-4">
        <Link
          to="/lecturer/pending-reviews"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          Back to Pending Reviews
        </Link>
      </div>

      {isLoading && <LoadingState label="Loading submission details" />}

      {!isLoading && error && !submission && (
        <ErrorState
          title="Could not load submission"
          message={error}
          onRetry={loadSubmission}
        />
      )}

      {!isLoading && successMessage && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {!isLoading && error && submission && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && submission && (
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Topic</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-950">{submission.title}</h2>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <dl className="mt-6 grid gap-5 md:grid-cols-2">
              <DetailItem label="Student Name" value={submission.student_name} />
              <DetailItem label="Student Email" value={submission.student_email} />
              <DetailItem label="Category" value={submission.category || 'Uncategorised'} />
              <DetailItem label="Keywords" value={submission.keywords} />
              <DetailItem label="Academic Session" value={submission.session_name} />
              <DetailItem label="Submitted Date" value={formatDate(submission.submitted_at)} />
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-950">Similarity Pre-check</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Run the existing MVP similarity checker against this submitted topic. Results are shown temporarily and do not change the submission status.
                </p>
              </div>
              <button
                type="button"
                disabled={isCheckingSimilarity}
                onClick={handleSimilarityCheck}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingSimilarity ? 'Checking...' : 'Run Similarity Check'}
              </button>
            </div>

            {isCheckingSimilarity && (
              <div className="mt-5">
                <LoadingState label="Running similarity check" />
              </div>
            )}

            {similarityError && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {similarityError}
              </div>
            )}

            {similarityStatus === 'partial_success' && similarityNotice && (
              <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {similarityNotice}
              </div>
            )}

            {similarityResults && (
              <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50">
                <ResultsDisplay results={similarityResults} />
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-950">Basic Decision</h3>
                <p className="mt-1 text-sm text-gray-600">
                  This updates only the submission status. Similarity results, notes, emails, audit trail, and lifecycle table writes are deferred.
                </p>
              </div>
              {!canUpdateStatus && (
                <p className="text-sm font-medium text-gray-500">
                  Actions are disabled because this submission is no longer pending review.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canUpdateStatus || isUpdating}
                onClick={() => handleStatusUpdate('approved', 'Approve', 'approved')}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={!canUpdateStatus || isUpdating}
                onClick={() => handleStatusUpdate('awaiting_revision', 'Request revision for', 'marked as awaiting revision')}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Request Revision
              </button>
              <button
                type="button"
                disabled={!canUpdateStatus || isUpdating}
                onClick={() => handleStatusUpdate('rejected', 'Reject', 'rejected')}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default SubmissionDetailPage;
