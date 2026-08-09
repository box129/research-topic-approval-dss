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

function getCounts(submissions) {
  return submissions.reduce((counts, submission) => {
    const status = normalizeStatus(submission.status);
    counts.total += 1;
    if (status === 'pending' || status === 'pending_review') counts.pending += 1;
    if (status === 'awaiting_revision') counts.awaitingRevision += 1;
    if (status === 'approved' || status === 'rejected') counts.decided += 1;
    return counts;
  }, { total: 0, pending: 0, awaitingRevision: 0, decided: 0 });
}

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
              <div className="rounded-full border border-status-revision-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Awaiting revision</dt><dd className="ml-2 inline font-bold">{counts.awaitingRevision}</dd></div>
              <div className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Decided</dt><dd className="ml-2 inline font-bold">{counts.decided}</dd></div>
            </dl>

            <section className="space-y-3" aria-label="Submission history">
              {submissions.map((submission, index) => {
                const status = normalizeStatus(submission.status);
                return (
                  <article key={submission.id || `${submission.title}-${index}`} className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
                    <StatusBadge status={submission.status || 'not_submitted'} />
                    <h2 className="mt-3 break-words font-serif text-lg font-semibold leading-snug text-text-primary">{submission.title}</h2>
                    <p className="mt-2 break-words text-sm leading-6 text-text-secondary">
                      {submission.category || 'Uncategorised'}
                      {submission.session_name ? ` · Session ${submission.session_name}` : ''}
                      {' · '} Submitted {formatDate(submission.submitted_at || submission.created_at)}
                      {submission.keywords ? ` · Keywords: ${submission.keywords}` : ''}
                    </p>

                    {DECIDED_STATUSES.has(status) && (
                      <div className="mt-4 border-t border-border-subtle pt-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Lecturer feedback</h3>
                        <p className="mt-2 break-words text-sm leading-6 text-text-secondary">{submission.decision_reason || 'No additional comment was provided.'}</p>
                        {submission.decided_at && <p className="mt-2 text-xs text-text-muted">Decision recorded {formatDate(submission.decided_at)}</p>}
                      </div>
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
