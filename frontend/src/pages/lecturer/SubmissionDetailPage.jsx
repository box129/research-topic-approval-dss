import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import RiskBadge from '../../components/ui/RiskBadge';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import TextAreaInput from '../../components/ui/TextAreaInput';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not submitted';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-card bg-surface-muted/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value || 'Not provided'}</dd>
    </div>
  );
}

function formatScore(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}%` : 'N/A';
}

function SnapshotTierCount({ label, value }) {
  return (
    <span className="rounded-badge bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary ring-1 ring-inset ring-border-subtle">
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
  const [pendingDecision, setPendingDecision] = useState(null);
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

  const handleStatusUpdate = (status, confirmLabel, successLabel, { requireReason = false } = {}) => {
    const normalizedReason = decisionReason.trim();

    if (requireReason && !normalizedReason) {
      setDecisionReasonError('Decision rationale is required when rejecting a submission.');
      return;
    }

    setPendingDecision({
      confirmLabel,
      requireReason,
      status,
      successLabel
    });
  };

  const confirmStatusUpdate = async () => {
    if (!pendingDecision) {
      return;
    }

    const normalizedReason = decisionReason.trim();

    if (pendingDecision.requireReason && !normalizedReason) {
      setDecisionReasonError('Decision rationale is required when rejecting a submission.');
      setPendingDecision(null);
      return;
    }

    setIsUpdating(true);
    setError('');
    setDecisionReasonError('');
    setSuccessMessage('');

    try {
      const updatedSubmission = await updateLecturerSubmissionStatus(
        topicId,
        pendingDecision.status,
        normalizedReason
      );
      setSubmission(updatedSubmission);
      setSuccessMessage(`Submission ${pendingDecision.successLabel} successfully.`);
      setDecisionReason('');
      setPendingDecision(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update submission status.');
      setPendingDecision(null);
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
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer Review"
        title="Submission Details"
        subtitle="Review the submitted topic, similarity evidence, and lecturer decision rationale."
        action={(
          <Link
            to="/lecturer/pending-reviews"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Pending Reviews
          </Link>
        )}
      />

      {isLoading && <LoadingState label="Loading submission details" />}

      {!isLoading && error && !submission && (
        <ErrorState
          title="Could not load submission"
          message={error}
          onRetry={loadSubmission}
        />
      )}

      {!isLoading && successMessage && (
        <InfoCallout
          title="Decision saved"
          message={successMessage}
          variant="success"
        />
      )}

      {!isLoading && error && submission && (
        <InfoCallout
          title="Action failed"
          message={error}
          variant="danger"
        />
      )}

      {!isLoading && submission && (
        <div className="space-y-7">
          <section className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-card">
            <div className="bg-[#fbfff7] p-5 sm:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-4xl">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green">Submitted Topic</p>
                  <h2 className="mt-3 text-2xl font-bold leading-tight text-text-primary sm:text-3xl">{submission.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Similarity evidence is advisory. Final decisions remain lecturer-controlled.
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={submission.status} />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 md:grid-cols-3">
                <DashboardStatusCard
                  label="Submitted"
                  value={formatDate(submission.submitted_at)}
                  helper="From the submission record"
                />
                <DashboardStatusCard
                  label="Academic Session"
                  value={submission.session_name || 'Not provided'}
                  helper="Returned by the submission API"
                />
                <DashboardStatusCard
                  label="Category"
                  value={submission.category || 'Uncategorised'}
                  helper="Student supplied field"
                />
              </div>

              <dl className="mt-6 grid gap-4 md:grid-cols-2">
                <DetailItem label="Student Name" value={submission.student_name} />
                <DetailItem label="Student Email" value={submission.student_email} />
                <DetailItem label="Keywords" value={submission.keywords} />
                <DetailItem label="Created Date" value={formatDate(submission.created_at)} />
              </dl>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Similarity Check History</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Saved similarity evidence from previous lecturer checks. This is not a final approval decision.
                </p>
              </div>
              <SecondaryButton type="button" disabled={isLoadingSnapshots} onClick={loadSnapshotHistory}>
                {isLoadingSnapshots ? 'Refreshing...' : 'Refresh History'}
              </SecondaryButton>
            </div>

            {isLoadingSnapshots && (
              <div className="mt-5">
                <LoadingState label="Loading similarity history" />
              </div>
            )}

            {snapshotError && (
              <InfoCallout
                className="mt-5"
                title="Could not load similarity history"
                message={snapshotError}
                variant="danger"
              >
                <SecondaryButton type="button" onClick={loadSnapshotHistory}>
                  Try again
                </SecondaryButton>
              </InfoCallout>
            )}

            {!isLoadingSnapshots && !snapshotError && snapshotHistory.length === 0 && (
              <InfoCallout
                className="mt-5"
                title="No saved similarity checks"
                message="No similarity checks have been saved for this submission yet."
              />
            )}

            {!isLoadingSnapshots && !snapshotError && snapshotHistory.length > 0 && (
              <div className="mt-5 space-y-3">
                {snapshotHistory.map((snapshot) => {
                  const tierCounts = snapshot.result_summary?.tierCounts || {};

                  return (
                    <article key={snapshot.id} className="rounded-[1rem] border border-border-subtle bg-[#f7fbf4] p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <RiskBadge level={snapshot.overall_risk || 'LOW'} />
                            <span className="rounded-badge bg-white px-2.5 py-1 text-xs font-semibold uppercase text-text-muted ring-1 ring-inset ring-border-subtle">
                              {snapshot.response_status || 'N/A'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-text-secondary">
                            Checked by {snapshot.checked_by?.name || 'Unknown lecturer'}
                            {snapshot.checked_by?.email ? ` (${snapshot.checked_by.email})` : ''}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {formatDate(snapshot.created_at)}
                          </p>
                        </div>
                        <div className="rounded-card bg-white px-3 py-2 text-sm font-semibold text-text-primary shadow-card">
                          Max similarity: {formatScore(snapshot.max_similarity)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <SnapshotTierCount label="Historical" value={tierCounts.historical} />
                        <SnapshotTierCount label="Current session" value={tierCounts.currentSession} />
                        <SnapshotTierCount label="Under review" value={tierCounts.underReview} />
                      </div>

                      <p className="mt-3 text-sm text-text-secondary">
                        {snapshot.recommendation || 'No recommendation captured.'}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Similarity Pre-check</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Run the existing lecturer similarity checker against this submitted topic. Results are temporary and do not change the submission status.
                </p>
              </div>
              <PrimaryButton type="button" disabled={isCheckingSimilarity} onClick={handleSimilarityCheck}>
                {isCheckingSimilarity ? 'Checking...' : 'Run Similarity Check'}
              </PrimaryButton>
            </div>

            {isCheckingSimilarity && (
              <div className="mt-5">
                <LoadingState label="Running similarity check" />
              </div>
            )}

            {similarityError && (
              <InfoCallout
                className="mt-5"
                title="Similarity check failed"
                message={similarityError}
                variant="danger"
              />
            )}

            {similarityStatus === 'partial_success' && similarityNotice && (
              <InfoCallout
                className="mt-5"
                title="Partial analysis"
                message={similarityNotice}
                variant="info"
              />
            )}

            {similarityResults && (
              <div className="mt-6 rounded-[1rem] border border-border-subtle bg-surface-muted p-2">
                <ResultsDisplay results={similarityResults} />
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Lecturer Decision</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  This updates only the submission status. Similarity results, lifecycle writes, emails, audit trail, and reporting remain out of scope.
                </p>
              </div>
              {!canUpdateStatus && (
                <p className="text-sm font-medium text-text-muted">
                  Actions are disabled because this submission is no longer pending review.
                </p>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <TextAreaInput
                id="decision-rationale"
                label="Decision rationale / comment"
                rows={4}
                value={decisionReason}
                disabled={!canUpdateStatus || isUpdating}
                error={decisionReasonError}
                helperText="This is a lecturer-provided rationale, not an automatic similarity decision. It is required when rejecting a topic."
                placeholder="Add the reason for this decision..."
                onChange={(event) => {
                  setDecisionReason(event.target.value);
                  if (decisionReasonError) {
                    setDecisionReasonError('');
                  }
                }}
              />

              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  disabled={!canUpdateStatus || isUpdating}
                  onClick={() => handleStatusUpdate('approved', 'Approve', 'approved')}
                >
                  Approve
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!canUpdateStatus || isUpdating}
                  className="border-feedback-warning-border text-feedback-warning hover:bg-feedback-warning-bg"
                  onClick={() => handleStatusUpdate('awaiting_revision', 'Request Revision', 'marked as awaiting revision')}
                >
                  Request Revision
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!canUpdateStatus || isUpdating}
                  className="border-feedback-danger-border text-feedback-danger hover:bg-feedback-danger-bg"
                  onClick={() => handleStatusUpdate('rejected', 'Reject', 'rejected', { requireReason: true })}
                >
                  Reject
                </SecondaryButton>
              </div>
            </div>

            {!canUpdateStatus && submission.decision_reason && (
              <InfoCallout
                className="mt-5"
                title="Stored lecturer rationale"
                message={submission.decision_reason}
              >
                <p className="text-xs text-text-muted">
                  Decided by {submission.decided_by_name || 'Unknown lecturer'} on {formatDate(submission.decided_at)}
                </p>
              </InfoCallout>
            )}
          </section>
        </div>
      )}

      <ConfirmActionModal
        confirmLabel={pendingDecision?.confirmLabel || 'Confirm'}
        isConfirming={isUpdating}
        isOpen={Boolean(pendingDecision)}
        message={pendingDecision ? `${pendingDecision.confirmLabel} this submission?` : ''}
        onCancel={() => setPendingDecision(null)}
        onConfirm={confirmStatusUpdate}
        title="Confirm Lecturer Decision"
        variant={pendingDecision?.status === 'rejected' ? 'danger' : 'default'}
      >
        <p className="text-sm text-text-secondary">
          This will update the submission status through the existing lecturer decision API.
        </p>
      </ConfirmActionModal>
    </LecturerDashboardLayout>
  );
}

export default SubmissionDetailPage;
