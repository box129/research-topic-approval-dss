import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import TextAreaInput from '../../components/ui/TextAreaInput';
import ResultsDisplay from '../../components/features/Results/ResultsDisplay';
import SimilarityClassificationChip from '../../components/features/Results/SimilarityClassificationChip';
import SimilarityEvidenceHistoryRegister, {
  RecordedClassificationToken,
  VOYAGE_RAW_COSINE_CONTRACT,
  formatCosineScore,
  formatStoredScore,
  historyCountLabel,
  historyListingSentence
} from '../../components/features/Results/SimilarityEvidenceHistoryRegister';
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

// The recorded human decision. Workflow decision colour is legitimate here and
// only here — a person produced the state.
const DECISION_PRESENTATION = {
  approved: {
    label: 'Approved',
    edgeClass: 'border-status-approved',
    textClass: 'text-status-approved'
  },
  rejected: {
    label: 'Rejected',
    edgeClass: 'border-status-rejected',
    textClass: 'text-status-rejected'
  },
  awaiting_revision: {
    label: 'Revision requested',
    edgeClass: 'border-status-revision',
    textClass: 'text-status-revision'
  }
};

const MODAL_VARIANT_BY_STATUS = {
  rejected: 'danger',
  awaiting_revision: 'revision'
};

// Frozen Board D D3 dialog grammar: the title names the specific action as a
// natural-English question and the message states the immediate consequence.
// The typed rationale is echoed read-only in the dialog body because it is the
// permanent, student-visible thing being committed.
const MODAL_COPY_BY_STATUS = {
  approved: {
    title: 'Approve this submission?',
    message: 'The submission status will be updated immediately and the student will see the outcome.'
  },
  awaiting_revision: {
    title: 'Request revision for this submission?',
    message: 'The submission status will be updated immediately and the student will be asked to revise and resubmit.'
  },
  rejected: {
    title: 'Reject this submission?',
    message: 'The submission status will be updated immediately. This is a terminal outcome and the student will see the recorded reason.'
  }
};

// One ruled cell in the proposal-context grid. Long values (a personal email
// most of all) get room first; overflow-wrap: break-word is the last resort
// and anywhere-wrapping is never used, so an email never splits mid-character.
function ContextField({ label, value, wide = false, deferred = false }) {
  return (
    <div
      className={[
        'border-b border-border-subtle py-2.5',
        wide ? 'sm:col-span-2' : '',
        deferred ? 'hidden sm:block' : ''
      ].filter(Boolean).join(' ')}
      data-testid={`context-field-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
    >
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm leading-6 text-text-primary">{value || 'Not provided'}</dd>
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
  const [showRegister, setShowRegister] = useState(false);
  const [showAllContext, setShowAllContext] = useState(false);

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
  const isTerminal = Boolean(submission) && !canUpdateStatus;
  const decisionPresentation = DECISION_PRESENTATION[submission?.status] || null;
  // The latest saved check and the recorded decision each carry their own
  // timestamp. No persisted relation exists between a decision and any
  // snapshot, so nothing here may phrase one relative to the other.
  const latestSnapshot = snapshotHistory[0] || null;
  const latestIsCurrentContract = latestSnapshot?.scoring_contract === VOYAGE_RAW_COSINE_CONTRACT;
  const registerVisible = isTerminal || showRegister;

  // On narrow terminal viewports the secondary context fields sit behind a
  // keyboard-operable disclosure; nothing is deleted — expansion reveals every
  // field, and at sm and above the full grid always renders.
  const deferContext = isTerminal && !showAllContext;

  const renderProposalContext = () => (
    <section aria-label="Proposal context" data-testid="proposal-context" className="border-t border-border-subtle pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Proposal context</p>
      <dl className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <ContextField label="Student" value={submission.student_name} />
        <ContextField label="Matric number" value={submission.student_matric_number} deferred={deferContext} />
        {submission.student_email && (
          <ContextField label="Personal email" value={submission.student_email} wide deferred={deferContext} />
        )}
        <ContextField label="Submitted" value={formatDate(submission.submitted_at)} />
        <ContextField label="Academic session" value={submission.session_name} deferred={deferContext} />
        <ContextField label="Category" value={submission.category || 'Uncategorised'} />
        <ContextField label="Keywords" value={submission.keywords} deferred={deferContext} />
        {/* The semantic context the similarity evidence was computed on.
            Shown only when supplied; an absent field is a genuinely absent
            field, not a gap in the record. */}
        {submission.population && <ContextField label="Population" value={submission.population} deferred={deferContext} />}
        {submission.location && <ContextField label="Location" value={submission.location} deferred={deferContext} />}
        {submission.study_focus && <ContextField label="Study focus" value={submission.study_focus} deferred={deferContext} />}
      </dl>
      {isTerminal && (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-text-primary underline underline-offset-2 hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 sm:hidden"
          aria-expanded={showAllContext}
          onClick={() => setShowAllContext((current) => !current)}
          data-testid="show-context-fields"
        >
          {showAllContext ? 'Hide extra context fields' : 'Show all context fields'}
        </button>
      )}
    </section>
  );

  const renderRevisionContext = () => (
    <section
      className="border-t border-border-subtle pt-5"
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
  );

  const renderEvidenceSection = () => (
    <section aria-label="Similarity evidence" data-testid="evidence-section" className="border-t border-border-subtle pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
        {isTerminal ? 'Supporting similarity evidence' : 'Similarity evidence'}
      </p>

      {latestSnapshot && (
        <div className="mt-3" data-testid="latest-saved-check">
          <p className="text-sm text-text-secondary">
            Latest saved similarity check · recorded {formatDate(latestSnapshot.created_at)} · by{' '}
            {latestSnapshot.checked_by?.name || 'Unknown lecturer'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {latestIsCurrentContract ? (
              <SimilarityClassificationChip value={latestSnapshot.overall_risk} showToken />
            ) : (
              /* Unknown-contract classification rests neutral: the stored raw
                 token as recorded metadata, never the current plain-language
                 vocabulary and never a verdict colour. */
              <RecordedClassificationToken
                token={latestSnapshot.overall_risk}
                data-testid="latest-recorded-classification"
              />
            )}
            <span className="font-mono text-[13px] text-text-primary">
              {latestIsCurrentContract
                ? `cosine ${formatCosineScore(latestSnapshot.max_similarity)}`
                : `score as recorded: ${formatStoredScore(latestSnapshot.max_similarity)}`}
            </span>
          </div>
          {!latestIsCurrentContract && latestSnapshot.max_similarity != null && (
            <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-5 text-text-muted">
              Historical scoring contract not recorded. This value is shown as stored and is not directly comparable with current cosine scores.
            </p>
          )}
        </div>
      )}

      {isCheckingSimilarity && (
        <div className="mt-4">
          <LoadingState label="Running similarity check" />
        </div>
      )}

      {similarityError && (
        <InfoCallout
          className="mt-4"
          title="Similarity check failed"
          message={similarityError}
          variant="danger"
        />
      )}

      {similarityStatus === 'semantic_unavailable' && similarityNotice && (
        <InfoCallout
          className="mt-4"
          title="Semantic similarity unavailable"
          message={`${similarityNotice} No similarity classification can be provided until semantic analysis is available.`}
          variant="warning"
        />
      )}

      {similarityResults && (
        <div className="mt-4 rounded-[10px] border border-border-subtle bg-white">
          <ResultsDisplay results={similarityResults} />
        </div>
      )}

      <div className="mt-4">
        <SecondaryButton
          type="button"
          className="min-h-11"
          disabled={isCheckingSimilarity}
          onClick={handleSimilarityCheck}
          data-testid="run-new-check"
        >
          {isCheckingSimilarity ? 'Checking...' : 'Run a new check'}
        </SecondaryButton>
        <p className="mt-1.5 text-[13.5px] text-text-secondary">
          Records additional advisory evidence. It does not change the submission status or alter the recorded lecturer decision.
        </p>
      </div>
    </section>
  );

  const renderHistorySection = () => (
    <section aria-label="Evidence history" data-testid="history-section" className="border-t border-border-subtle pt-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Evidence history</p>
          <p className="mt-1 text-sm font-semibold text-text-primary" data-testid="history-summary">
            {historyCountLabel(snapshotHistory.length)}
            {snapshotHistory.length > 0 && ` · latest ${formatDate(snapshotHistory[0]?.created_at)}`}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Saved similarity evidence from lecturer checks. This is not a final approval decision.
          </p>
          {snapshotHistory.length > 0 && (
            <p className="mt-0.5 text-[13.5px] text-text-secondary" data-testid="history-listing-note">
              {historyListingSentence(snapshotHistory.length)}
            </p>
          )}
        </div>
        <SecondaryButton type="button" disabled={isLoadingSnapshots} onClick={loadSnapshotHistory}>
          {isLoadingSnapshots ? 'Refreshing...' : 'Refresh History'}
        </SecondaryButton>
      </div>

      {isLoadingSnapshots && (
        <div className="mt-4">
          <LoadingState label="Loading similarity history" />
        </div>
      )}

      {snapshotError && (
        <InfoCallout
          className="mt-4"
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
          className="mt-4"
          title="No saved similarity checks"
          message="No similarity checks have been saved for this submission yet."
        />
      )}

      {!isLoadingSnapshots && !snapshotError && snapshotHistory.length > 0 && (
        <div className="mt-4">
          {!isTerminal && (
            <button
              type="button"
              className="text-sm font-medium text-text-primary underline underline-offset-2 hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
              aria-expanded={showRegister}
              onClick={() => setShowRegister((current) => !current)}
              data-testid="show-register"
            >
              {showRegister ? 'Hide register' : 'Show register'}
            </button>
          )}
          {registerVisible && (
            <div className={!isTerminal ? 'mt-3' : ''}>
              <SimilarityEvidenceHistoryRegister snapshots={snapshotHistory} />
            </div>
          )}
        </div>
      )}
    </section>
  );

  return (
    <LecturerDashboardLayout>
      <div className="mx-auto w-full max-w-[74rem]">
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
            className="mb-5"
            title="Decision saved"
            message={successMessage}
            variant="success"
          />
        )}

        {!isLoading && error && submission && (
          <InfoCallout
            className="mb-5"
            title="Action failed"
            message={error}
            variant="danger"
          />
        )}

        {!isLoading && submission && (
          <div className="space-y-6">
            <header className="border-b border-border-subtle pb-4" data-testid="identity-header">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                    {submission.revision_of ? 'Lecturer review · revised topic' : 'Lecturer review · submitted topic'}
                  </p>
                  <h1 className="mt-2 break-words text-2xl font-bold leading-8 text-text-primary">{submission.title}</h1>
                  {!isTerminal && (
                    <p className="mt-2 text-sm text-text-secondary">
                      Similarity evidence is advisory. Final decisions remain lecturer-controlled.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <StatusBadge status={submission.status} />
                  <Link
                    to="/lecturer/pending-reviews"
                    className="inline-flex min-h-11 items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
                  >
                    Back to Pending Reviews
                  </Link>
                </div>
              </div>
            </header>

            {/* Terminal records lead with the human decision: the first
                substantive thing read is what a person decided and why. The
                decision and any saved check each carry their own timestamp —
                no relation between them is asserted. */}
            {isTerminal && decisionPresentation && (
              <section
                aria-label="Recorded decision"
                data-testid="recorded-decision"
                className={`border-t-[3px] ${decisionPresentation.edgeClass} pt-4`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Recorded decision</p>
                <p className={`mt-1 text-[27px] font-bold leading-9 ${decisionPresentation.textClass}`} data-testid="decision-outcome">
                  {decisionPresentation.label}
                </p>
                <p className="mt-1 text-sm text-text-secondary" data-testid="decision-meta">
                  by {submission.decided_by_name || 'Unknown lecturer'} on {formatDate(submission.decided_at)}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Lecturer rationale</p>
                {submission.decision_reason ? (
                  <p className="mt-1 max-w-[62ch] whitespace-pre-line break-words text-[17px] leading-7 text-text-primary" data-testid="decision-rationale-text">
                    {submission.decision_reason}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-text-muted" data-testid="decision-rationale-text">
                    No rationale was recorded.
                  </p>
                )}
                <p className="mt-4 text-[13.5px] text-text-muted" data-testid="terminal-note">
                  This submission is no longer pending review, so no further decision can be recorded here.
                </p>
              </section>
            )}

            {renderProposalContext()}

            {submission.revision_of && renderRevisionContext()}

            {renderEvidenceSection()}

            {renderHistorySection()}

            {/* The human decision region — pending records only. Terminal
                records render no decision controls at all: the backend rejects
                further transitions and a control that cannot be used is not
                information. */}
            {!isTerminal && (
              <section
                aria-label="Lecturer decision"
                data-testid="decision-section"
                className="border-t-2 border-brand-green pt-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Controlled action</p>
                <h2 className="mt-1 text-lg font-semibold text-text-primary">Lecturer decision</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Record the academic decision after reviewing the submission, available evidence, and rationale.
                </p>

                <div className="mt-4 max-w-[45rem]">
                  <TextAreaInput
                    id="decision-rationale"
                    label="Decision rationale / comment"
                    rows={4}
                    value={decisionReason}
                    disabled={isUpdating}
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
                </div>

                <p className="mt-3 text-[13.5px] text-text-secondary" data-testid="rationale-rules">
                  Approve — rationale optional · Request Revision — rationale required · Reject — rationale required
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <PrimaryButton
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate('approved', 'Approve', 'approved')}
                  >
                    Approve
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    className="min-h-11 w-full border-feedback-warning-border text-feedback-warning hover:bg-feedback-warning-bg sm:w-auto"
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate('awaiting_revision', 'Request Revision', 'revision requested')}
                  >
                    Request Revision
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    className="min-h-11 w-full border-feedback-danger-border text-feedback-danger hover:bg-feedback-danger-bg sm:w-auto"
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate('rejected', 'Reject', 'rejected')}
                  >
                    Reject
                  </SecondaryButton>
                </div>
              </section>
            )}
          </div>
        )}

        <ConfirmActionModal
          confirmLabel={pendingDecision?.confirmLabel || 'Confirm'}
          isConfirming={isUpdating}
          isOpen={Boolean(pendingDecision)}
          message={(pendingDecision && MODAL_COPY_BY_STATUS[pendingDecision.status]?.message) || ''}
          onCancel={() => setPendingDecision(null)}
          onConfirm={confirmStatusUpdate}
          title={(pendingDecision && MODAL_COPY_BY_STATUS[pendingDecision.status]?.title) || 'Confirm Lecturer Decision'}
          variant={MODAL_VARIANT_BY_STATUS[pendingDecision?.status] || 'default'}
        >
          {/* Rationale echo — confirmation context only, never editable here.
              The parent decisionReason state stays authoritative; approval's
              honest fallback makes the per-action contract visible at the
              moment of consequence (frozen Board D D3). */}
          <div className="rounded-md border border-border-subtle bg-surface-muted px-4 py-3" data-testid="decision-rationale-echo">
            <p className="text-sm font-semibold text-text-primary">Decision rationale</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-text-secondary">
              {decisionReason.trim() || 'Not provided — optional for approval.'}
            </p>
          </div>
        </ConfirmActionModal>
      </div>
    </LecturerDashboardLayout>
  );
}

export default SubmissionDetailPage;
