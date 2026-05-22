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
  listLecturerSubmissionSimilaritySnapshots,
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

function formatScore(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}%` : 'N/A';
}

function getRiskBadgeClass(risk) {
  const normalizedRisk = String(risk || '').toLowerCase();

  if (normalizedRisk === 'high') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  if (normalizedRisk === 'medium') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  if (normalizedRisk === 'low') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  return 'bg-gray-50 text-gray-700 ring-gray-200';
}

function SnapshotTierCount({ label, value }) {
  return (
    <span className="rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
      {label}: {Number.isFinite(Number(value)) ? value : 0}
    </span>
  );
}

function SubmissionDetailPage() {
  const { topicId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionReasonError, setDecisionReasonError] = useState('');
  const [similarityResults, setSimilarityResults] = useState(null);
  const [similarityStatus, setSimilarityStatus] = useState('');
  const [similarityNotice, setSimilarityNotice] = useState('');
  const [similarityError, setSimilarityError] = useState('');
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');

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

  const loadSnapshotHistory = useCallback(async () => {
    if (!topicId) {
      return;
    }

    setIsLoadingSnapshots(true);
    setSnapshotError('');

    try {
      setSnapshotHistory(await listLecturerSubmissionSimilaritySnapshots(topicId));
    } catch (err) {
      setSnapshotError(err.response?.data?.message || 'Unable to load similarity check history.');
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [topicId]);

  const handleStatusUpdate = async (status, confirmLabel, successLabel, { requireReason = false } = {}) => {
    const normalizedReason = decisionReason.trim();

    if (requireReason && !normalizedReason) {
      setDecisionReasonError('Decision rationale is required when rejecting a submission.');
      return;
    }

    const confirmed = window.confirm(`${confirmLabel} this submission?`);
    if (!confirmed) {
      return;
    }

    setIsUpdating(true);
    setError('');
    setDecisionReasonError('');
    setSuccessMessage('');

    try {
      const updatedSubmission = await updateLecturerSubmissionStatus(topicId, status, normalizedReason);
      setSubmission(updatedSubmission);
      setSuccessMessage(`Submission ${successLabel} successfully.`);
      setDecisionReason('');
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
      await loadSnapshotHistory();
    } catch (err) {
      setSimilarityError(err.response?.data?.message || err.message || 'Unable to run similarity check.');
    } finally {
      setIsCheckingSimilarity(false);
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  useEffect(() => {
    loadSnapshotHistory();
  }, [loadSnapshotHistory]);

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
                <h3 className="text-base font-semibold text-gray-950">Similarity Check History</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Saved similarity evidence from previous lecturer checks. This is not a final approval decision.
                </p>
              </div>
              <button
                type="button"
                disabled={isLoadingSnapshots}
                onClick={loadSnapshotHistory}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingSnapshots ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {isLoadingSnapshots && (
              <div className="mt-5">
                <LoadingState label="Loading similarity history" />
              </div>
            )}

            {snapshotError && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{snapshotError}</p>
                <button
                  type="button"
                  onClick={loadSnapshotHistory}
                  className="mt-2 font-semibold text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoadingSnapshots && !snapshotError && snapshotHistory.length === 0 && (
              <p className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                No similarity checks have been saved for this submission yet.
              </p>
            )}

            {!isLoadingSnapshots && !snapshotError && snapshotHistory.length > 0 && (
              <div className="mt-5 space-y-3">
                {snapshotHistory.map((snapshot) => {
                  const tierCounts = snapshot.result_summary?.tierCounts || {};

                  return (
                    <article key={snapshot.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ring-1 ring-inset ${getRiskBadgeClass(snapshot.overall_risk)}`}>
                              {snapshot.overall_risk || 'N/A'}
                            </span>
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              {snapshot.response_status || 'N/A'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">
                            Checked by {snapshot.checked_by?.name || 'Unknown lecturer'}
                            {snapshot.checked_by?.email ? ` (${snapshot.checked_by.email})` : ''}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDate(snapshot.created_at)}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          Max similarity: {formatScore(snapshot.max_similarity)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <SnapshotTierCount label="Historical" value={tierCounts.historical} />
                        <SnapshotTierCount label="Current session" value={tierCounts.currentSession} />
                        <SnapshotTierCount label="Under review" value={tierCounts.underReview} />
                      </div>

                      <p className="mt-3 text-sm text-gray-700">
                        {snapshot.recommendation || 'No recommendation captured.'}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
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
              <div className="w-full">
                <label htmlFor="decision-rationale" className="block text-sm font-semibold text-gray-900">
                  Decision rationale / comment
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  This is a lecturer-provided rationale, not an automatic similarity decision. It is required when rejecting a topic.
                </p>
                <textarea
                  id="decision-rationale"
                  rows={4}
                  value={decisionReason}
                  disabled={!canUpdateStatus || isUpdating}
                  onChange={(event) => {
                    setDecisionReason(event.target.value);
                    if (decisionReasonError) {
                      setDecisionReasonError('');
                    }
                  }}
                  className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Add the reason for this decision..."
                />
                {decisionReasonError && (
                  <p className="mt-2 text-sm text-red-700">{decisionReasonError}</p>
                )}
              </div>

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
                onClick={() => handleStatusUpdate('rejected', 'Reject', 'rejected', { requireReason: true })}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject
              </button>
            </div>

            {!canUpdateStatus && submission.decision_reason && (
              <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">Stored lecturer rationale</p>
                <p className="mt-1">{submission.decision_reason}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Decided by {submission.decided_by_name || 'Unknown lecturer'} on {formatDate(submission.decided_at)}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default SubmissionDetailPage;
