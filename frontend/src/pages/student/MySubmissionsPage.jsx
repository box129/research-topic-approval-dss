import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSubmissions } from '../../api/submissions';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const DECIDED_STATUSES = new Set(['approved', 'rejected', 'awaiting_revision']);

function normalizeStatus(status) {
  return String(status || 'not_submitted').toLowerCase();
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

/**
 * Translates the stored lifecycle into what the student needs to know: what
 * state this topic is in, whether they have to do something, and what happens
 * next.
 *
 * Every label below is derived from real stored data — the submission status and
 * whether a linked revision exists. Nothing here invents a state the backend
 * cannot represent. In particular "Revised" is not a stored status: it is what
 * AWAITING_REVISION means once the student has actually submitted the linked
 * revision, which is the difference between a topic that still needs work and
 * one that has already been dealt with.
 */
function describeSubmission(submission) {
  const status = normalizeStatus(submission.status);
  const hasRevision = Boolean(submission.has_revision);

  if (status === 'awaiting_revision') {
    return hasRevision
      ? {
        label: 'Revised',
        showLabel: true,
        actionRequired: false,
        // Order-independent: the list is newest-first, so the revision is not "below".
        nextStep: 'You have submitted a revision of this topic. Its progress is shown on the revised submission in this list.'
      }
      : {
        label: 'Revision required',
        showLabel: true,
        actionRequired: true,
        nextStep: 'Read your lecturer feedback, then revise and resubmit this topic.'
      };
  }

  if (status === 'pending_review' || status === 'pending') {
    return {
      // Workflow vocabulary aligned with StatusBadge; "under review" stays
      // reserved for the repository lifecycle bucket (Board D2 E2.3).
      label: submission.is_revision ? 'Revised — pending review' : 'Pending review',
      // Only worth saying when lineage changes the meaning; otherwise the status
      // badge already says "pending review" and repeating it adds nothing.
      showLabel: Boolean(submission.is_revision),
      actionRequired: false,
      nextStep: 'No action needed. Your lecturer will review this topic.'
    };
  }

  if (status === 'approved') {
    return { label: 'Approved', showLabel: false, actionRequired: false, nextStep: 'No further action is needed for this topic.' };
  }

  if (status === 'rejected') {
    return { label: 'Rejected', showLabel: false, actionRequired: false, nextStep: 'This topic was not approved. You can submit a different topic.' };
  }

  return { label: 'Not submitted', showLabel: false, actionRequired: false, nextStep: '' };
}

function getCounts(submissions) {
  return submissions.reduce((counts, submission) => {
    const status = normalizeStatus(submission.status);
    counts.total += 1;
    if (status === 'pending' || status === 'pending_review') counts.pending += 1;
    if (status === 'awaiting_revision') counts.awaitingRevision += 1;
    if (status === 'approved' || status === 'rejected') counts.decided += 1;
    if (describeSubmission(submission).actionRequired) counts.actionRequired += 1;
    return counts;
  }, { total: 0, pending: 0, awaitingRevision: 0, decided: 0, actionRequired: 0 });
}

// Topic-level revision history only: what was proposed, what was asked for, and
// what replaced it. Deliberately not a document-versioning view.
function RevisionHistory({ submission }) {
  const previous = submission.revision_of;
  const next = submission.revision;

  if (!previous && !next) return null;

  return (
    <div className="mt-4 border-t border-border-subtle pt-4" data-testid={`revision-history-${submission.id}`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Revision history</h3>
      <ol className="mt-2 space-y-2 text-sm leading-6 text-text-secondary">
        {previous && (
          <>
            <li className="break-words">
              <span className="font-semibold text-text-primary">Original submission</span>
              {' — '}{previous.title}
              <span className="block text-xs text-text-muted">Submitted {formatDate(previous.submitted_at)}</span>
            </li>
            <li className="break-words">
              <span className="font-semibold text-text-primary">Revision requested</span>
              <span className="block whitespace-pre-line break-words">{previous.decision_reason || 'No feedback was recorded with this request.'}</span>
              <span className="block text-xs text-text-muted">{formatDate(previous.decided_at)}</span>
            </li>
            <li className="break-words">
              <span className="font-semibold text-text-primary">This revised submission</span>
              <span className="block text-xs text-text-muted">Submitted {formatDate(submission.submitted_at)}</span>
            </li>
          </>
        )}
        {next && (
          <li className="break-words">
            <span className="font-semibold text-text-primary">Replaced by your revised submission</span>
            {' — '}{next.title}
            <span className="block text-xs text-text-muted">Submitted {formatDate(next.submitted_at)}</span>
          </li>
        )}
      </ol>
    </div>
  );
}

RevisionHistory.propTypes = {
  submission: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    submitted_at: PropTypes.string,
    revision_of: PropTypes.object,
    revision: PropTypes.object
  }).isRequired
};

function MySubmissionsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const counts = useMemo(() => getCounts(submissions), [submissions]);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSubmissions(await listSubmissions());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load submissions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  return (
    <StudentDashboardLayout>
      <div className="mx-auto max-w-[60rem] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[1.65rem] font-semibold leading-tight text-brand-green-dark">My Submissions</h1>
            <p className="mt-1 text-sm text-text-secondary">Your submission history, status, and lecturer feedback.</p>
          </div>
          <SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>Submit Topic</SecondaryButton>
        </header>

        {isLoading && <LoadingState label="Loading submissions" />}
        {!isLoading && error && <ErrorState title="Could not load submissions" message={error} onRetry={loadSubmissions} />}

        {!isLoading && !error && submissions.length === 0 && (
          <EmptyStatePanel
            title="No submissions yet"
            message="Submit your first research topic when you are ready for lecturer review."
            action={(
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <PrimaryButton type="button" onClick={() => navigate('/student/submit-topic')}>Submit Topic</PrimaryButton>
                <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>Check My Topic</SecondaryButton>
              </div>
            )}
          />
        )}

        {!isLoading && !error && submissions.length > 0 && (
          <>
            <dl className="flex flex-wrap gap-2" aria-label="Submission summary">
              <div className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Total</dt><dd className="ml-2 inline font-bold">{counts.total}</dd></div>
              <div className="rounded-full border border-status-pending-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Pending</dt><dd className="ml-2 inline font-bold">{counts.pending}</dd></div>
              <div className="rounded-full border border-status-revision-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Revision requested</dt><dd className="ml-2 inline font-bold">{counts.awaitingRevision}</dd></div>
              <div className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Decided</dt><dd className="ml-2 inline font-bold">{counts.decided}</dd></div>
            </dl>

            <section className="space-y-3" aria-label="Submission history">
              {submissions.map((submission, index) => {
                const status = normalizeStatus(submission.status);
                const presentation = describeSubmission(submission);
                return (
                  <article
                    key={submission.id || `${submission.title}-${index}`}
                    className={`rounded-[10px] border bg-white p-5 shadow-card ${presentation.actionRequired ? 'border-status-revision border-l-4' : 'border-border-subtle'}`}
                    data-testid={`submission-card-${submission.id}`}
                  >
                    {/* D2 record grammar: the topic title is the card's primary
                        identity and reads first; the workflow pill follows it;
                        the attention condition is announced in words after the
                        status. */}
                    <h2 className="break-words font-serif text-lg font-semibold leading-snug text-text-primary">{submission.title}</h2>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={submission.status || 'not_submitted'} />
                      {presentation.showLabel && (
                        <span className="text-sm font-semibold text-text-primary" data-testid={`submission-state-${submission.id}`}>
                          {presentation.label}
                        </span>
                      )}
                    </div>

                    {/* Derived attention condition, not a stored workflow
                        status: plain sentence-case text, never the pill
                        costume. The card's revision left edge plus this text
                        keep colour from being the only cue. */}
                    {presentation.actionRequired && (
                      <p
                        className="mt-2 text-sm font-semibold text-status-revision"
                        data-testid={`action-required-${submission.id}`}
                      >
                        Action required
                      </p>
                    )}
                    <p className="mt-2 break-words text-sm leading-6 text-text-secondary">
                      {submission.category || 'Uncategorised'}
                      {submission.session_name ? ` · Session ${submission.session_name}` : ''}
                      {' · '} Submitted {formatDate(submission.submitted_at || submission.created_at)}
                      {submission.keywords ? ` · Keywords: ${submission.keywords}` : ''}
                    </p>
                    {/* The research context this submission is compared on. Each
                        field is shown only when supplied, so a topic submitted
                        without context shows nothing here rather than "Not
                        provided" three times. */}
                    {(submission.population || submission.location || submission.study_focus) && (
                      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary" data-testid={`submission-context-${submission.id}`}>
                        {submission.population && <div className="min-w-0"><dt className="inline font-semibold">Population:</dt> <dd className="inline break-words">{submission.population}</dd></div>}
                        {submission.location && <div className="min-w-0"><dt className="inline font-semibold">Location:</dt> <dd className="inline break-words">{submission.location}</dd></div>}
                        {submission.study_focus && <div className="min-w-0"><dt className="inline font-semibold">Study focus:</dt> <dd className="inline break-words">{submission.study_focus}</dd></div>}
                      </dl>
                    )}

                    {DECIDED_STATUSES.has(status) && (
                      <div className="mt-4 border-t border-border-subtle pt-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Lecturer feedback</h3>
                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-text-secondary" data-testid={`feedback-${submission.id}`}>{submission.decision_reason || 'No additional comment was provided.'}</p>
                        {submission.decided_at && <p className="mt-2 text-xs text-text-muted">Decision recorded {formatDate(submission.decided_at)}</p>}
                      </div>
                    )}

                    {/* The action sits directly under the feedback it responds
                        to, so the student never has to go and find a generic
                        submit form and remember what was asked for. */}
                    {presentation.actionRequired && (
                      <div className="mt-4">
                        <PrimaryButton
                          type="button"
                          className="w-full sm:w-auto"
                          onClick={() => navigate(`/student/my-submissions/${submission.id}/revise`)}
                          data-testid={`revise-${submission.id}`}
                        >
                          Revise and Resubmit
                        </PrimaryButton>
                      </div>
                    )}

                    <RevisionHistory submission={submission} />

                    {presentation.nextStep && (
                      <p className="mt-4 text-sm text-text-muted" data-testid={`next-step-${submission.id}`}>{presentation.nextStep}</p>
                    )}
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </StudentDashboardLayout>
  );
}

export default MySubmissionsPage;
