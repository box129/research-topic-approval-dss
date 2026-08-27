import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
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

// Mirrors the backend rule so the lecturer is told before the request is sent.
// Both decisions that hand work back to the student must say why, and requesting
// a revision most of all: that action asks the student to change something, so
// sending it without feedback leaves them nothing to act on.
const MIN_DECISION_REASON_LENGTH = 10;

const REASON_REQUIRED_MESSAGES = {
  rejected: 'Decision rationale is required when rejecting a submission.',
  awaiting_revision: 'Revision feedback is required so the student knows what to change.'
};

function reasonValidationError(status, normalizedReason) {
  const requiredMessage = REASON_REQUIRED_MESSAGES[status];

  if (!requiredMessage) {
    return '';
  }

  if (!normalizedReason) {
    return requiredMessage;
  }

  if (normalizedReason.length < MIN_DECISION_REASON_LENGTH) {
    return `Please give at least ${MIN_DECISION_REASON_LENGTH} characters so the student knows what to change.`;
  }

  return '';
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-[8px] border border-border-subtle bg-surface-page p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-text-primary">{value || 'Not provided'}</dd>
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

  const handleStatusUpdate = (status, confirmLabel, successLabel) => {
    const normalizedReason = decisionReason.trim();
    const validationError = reasonValidationError(status, normalizedReason);

    if (validationError) {
      setDecisionReasonError(validationError);
      requestAnimationFrame(() => document.getElementById('decision-rationale')?.focus());
      return;
    }

    setPendingDecision({
      confirmLabel,
      status,
      successLabel
    });
  };

  const confirmStatusUpdate = async () => {
    if (!pendingDecision) {
      return;
    }

    const normalizedReason = decisionReason.trim();
    const validationError = reasonValidationError(pendingDecision.status, normalizedReason);

    if (validationError) {
      setDecisionReasonError(validationError);
      setPendingDecision(null);
      requestAnimationFrame(() => document.getElementById('decision-rationale')?.focus());
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
      setSimilarityResults(response.results?.semantic_available === false ? null : response.results);
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
        <div className="space-y-5">
          <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                  {submission.revision_of ? 'Revised topic' : 'Submitted topic'}
                </p>
                <h2 className="mt-2 break-words text-xl font-bold leading-7 text-text-primary">{submission.title}</h2>
              </div>
              <div className="shrink-0"><StatusBadge status={submission.status} /></div>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Similarity evidence is advisory. Final decisions remain lecturer-controlled.
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Student" value={submission.student_name} />
              <DetailItem label="Matric number" value={submission.student_matric_number} />
              {submission.student_email && (
                <DetailItem label="Personal email" value={submission.student_email} />
              )}
              <DetailItem label="Academic session" value={submission.session_name} />
              <DetailItem label="Category" value={submission.category || 'Uncategorised'} />
              <DetailItem label="Keywords" value={submission.keywords} />
              <DetailItem label="Submitted" value={formatDate(submission.submitted_at)} />
              {/* The semantic context the similarity evidence was computed on.
                  Shown only when supplied; an absent field is a genuinely
                  absent field, not a gap in the record. */}
              {submission.population && <DetailItem label="Population" value={submission.population} />}
              {submission.location && <DetailItem label="Location" value={submission.location} />}
              {submission.study_focus && <DetailItem label="Study focus" value={submission.study_focus} />}
            </dl>
          </section>

          {submission.revision_of && (
            <section
              className="rounded-[10px] border border-status-revision-bg bg-white p-5 shadow-card sm:p-6"
              aria-label="Revision context"
              data-testid="lecturer-revision-context"
            >
              <h3 className="text-base font-bold text-text-primary">Revision context</h3>
              <p className="mt-1 text-sm text-text-secondary">
                This topic replaces an earlier submission by the same student.
              </p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Previously proposed</dt>
                  <dd className="mt-1 break-words text-sm text-text-primary" data-testid="revision-previous-title">
                    {submission.revision_of.title}
                  </dd>
                  {[
                    ['Population', submission.revision_of.population],
                    ['Location', submission.revision_of.location],
                    ['Study focus', submission.revision_of.study_focus]
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <dd key={label} className="mt-1 break-words text-sm text-text-secondary" data-testid={`revision-previous-${label.toLowerCase().replace(' ', '-')}`}>
                      {label}: {value}
                    </dd>
                  ))}
                  {submission.revision_of.keywords && (
                    <dd className="mt-1 break-words text-sm text-text-secondary">
                      Keywords: {submission.revision_of.keywords}
                    </dd>
                  )}
                  <dd className="mt-1 text-xs text-text-muted">
                    Submitted {formatDate(submission.revision_of.submitted_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Revision requested</dt>
                  <dd
                    className="mt-1 break-words text-sm leading-6 text-text-primary"
                    data-testid="revision-previous-feedback"
                  >
                    {submission.revision_of.decision_reason || 'No feedback was recorded with this request.'}
                  </dd>
                  <dd className="mt-1 text-xs text-text-muted">
                    {formatDate(submission.revision_of.decided_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Now proposed</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-text-primary" data-testid="revision-current-title">
                    {submission.title}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
            <div className="border-b border-border-subtle p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                  Evidence history
                </p>
                <h3 className="text-lg font-semibold text-text-primary">Similarity Check History</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Saved similarity evidence from previous lecturer checks. This is not a final approval decision.
                </p>
              </div>
              <SecondaryButton type="button" disabled={isLoadingSnapshots} onClick={loadSnapshotHistory}>
                {isLoadingSnapshots ? 'Refreshing...' : 'Refresh History'}
              </SecondaryButton>
              </div>
            </div>

            <div className="p-5">

            {isLoadingSnapshots && (
              <div>
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
                title="No saved similarity checks"
                message="No similarity checks have been saved for this submission yet."
              />
            )}

            {!isLoadingSnapshots && !snapshotError && snapshotHistory.length > 0 && (
              <div className="mt-5 space-y-3">
                {snapshotHistory.map((snapshot) => {
                  const tierCounts = snapshot.result_summary?.tierCounts || {};

                  return (
                    <article key={snapshot.id} className="rounded-[8px] border border-border-subtle bg-surface-page p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <RiskBadge level={snapshot.overall_risk || 'NONE'} />
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
            </div>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]">
              <div className="border-b border-border-subtle bg-surface-page p-5 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                  Similarity evidence
                </p>
                <h3 className="mt-2 text-xl font-semibold text-text-primary">Similarity Pre-check</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Run and save a similarity check for this submitted topic. It records advisory evidence and does not change the submission status or lecturer decision.
                </p>
                <div className="mt-5">
                  <PrimaryButton type="button" disabled={isCheckingSimilarity} onClick={handleSimilarityCheck}>
                    {isCheckingSimilarity ? 'Checking...' : 'Run Similarity Check'}
                  </PrimaryButton>
                </div>
              </div>

              <div className="min-w-0 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Check output
                </p>

                {isCheckingSimilarity && (
                  <div>
                    <LoadingState label="Running similarity check" />
                  </div>
                )}

                {similarityError && (
                  <InfoCallout
                    title="Similarity check failed"
                    message={similarityError}
                    variant="danger"
                  />
                )}

                {similarityStatus === 'semantic_unavailable' && similarityNotice && (
                  <InfoCallout
                    className="mb-5"
                    title="Semantic similarity unavailable"
                    message={`${similarityNotice} No similarity classification can be provided until semantic analysis is available.`}
                    variant="warning"
                  />
                )}

                {similarityResults && (
                  <div className="rounded-[8px] border border-border-subtle bg-surface-muted p-2">
                    <ResultsDisplay results={similarityResults} />
                  </div>
                )}

                {!isCheckingSimilarity && !similarityError && !similarityResults && (
                  <InfoCallout
                    title="No additional check result"
                    message="Run a similarity check when you need to record additional advisory evidence for this submitted topic."
                  />
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
            <div className="border-b border-border-subtle bg-surface-page p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                    Controlled action
                  </p>
                  <h3 className="text-lg font-semibold text-text-primary">Lecturer Decision</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Record the academic decision after reviewing the submission, available evidence, and rationale.
                  </p>
                </div>
                {!canUpdateStatus && (
                  <p className="text-sm font-medium text-text-muted">
                    Actions are disabled because this submission is no longer pending review.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              <TextAreaInput
                id="decision-rationale"
                label="Decision rationale / comment"
                rows={4}
                value={decisionReason}
                disabled={!canUpdateStatus || isUpdating}
                error={decisionReasonError}
                helperText="Required when rejecting a topic or requesting a revision, so the student knows what to change. Similarity evidence remains advisory."
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
                  onClick={() => handleStatusUpdate('rejected', 'Reject', 'rejected')}
                >
                  Reject
                </SecondaryButton>
              </div>
            </div>

            {!canUpdateStatus && submission.decision_reason && (
              <InfoCallout
                className="mx-5 mb-5"
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
          Confirm this lecturer decision. The submission status will be updated immediately.
        </p>
      </ConfirmActionModal>
    </LecturerDashboardLayout>
  );
}

export default SubmissionDetailPage;
