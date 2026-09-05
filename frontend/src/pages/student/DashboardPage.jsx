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

function timestampOf(submission) {
  const value = submission?.submitted_at || submission?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestSubmission(submissions) {
  return submissions.reduce((latest, item) => !latest || timestampOf(item) > timestampOf(latest) ? item : latest, null);
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function statusGuidance(submission) {
  const status = normalizeStatus(submission?.status);
  if (status === 'pending' || status === 'pending_review') return { title: 'Lecturer review is pending', message: 'No action is required on this record right now.', action: 'View My Submissions' };
  if (status === 'awaiting_revision') return { title: 'Revision requested', message: 'Review the feedback above, then submit a revised topic for lecturer review.', action: 'View My Submissions' };
  if (status === 'approved') return { title: 'Topic approved', message: 'You can continue with the next academic steps provided by your department.', action: 'View My Submissions' };
  if (status === 'rejected') return { title: 'Topic rejected', message: 'Review the feedback before choosing another proposal.', action: 'View My Submissions' };
  return { title: 'Submission status available', message: 'Open My Submissions to review the recorded status and available information.', action: 'View My Submissions' };
}

function summaryFor(submissions) {
  return submissions.reduce((summary, item) => {
    const status = normalizeStatus(item.status);
    summary.total += 1;
    if (status === 'pending' || status === 'pending_review') summary.pending += 1;
    if (status === 'awaiting_revision') summary.revision += 1;
    if (status === 'approved') summary.approved += 1;
    return summary;
  }, { total: 0, pending: 0, revision: 0, approved: 0 });
}

function StudentDashboardPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try { setSubmissions(await listSubmissions()); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load student dashboard.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);
  const current = useMemo(() => latestSubmission(submissions), [submissions]);
  const summary = useMemo(() => summaryFor(submissions), [submissions]);
  const guidance = statusGuidance(current);
  const status = normalizeStatus(current?.status);

  return (
    <StudentDashboardLayout>
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Student Dashboard</h1>
      </header>

      {isLoading && <LoadingState label="Loading student dashboard" />}
      {!isLoading && error && <ErrorState title="Could not load student dashboard" message={error} onRetry={loadSubmissions} />}

      {!isLoading && !error && !current && (
        <EmptyStatePanel
          title="No topic submitted yet"
          message="Check an idea before submission or create a topic when you are ready for lecturer review."
          action={<div className="flex flex-col justify-center gap-3 sm:flex-row"><PrimaryButton type="button" onClick={() => navigate('/student/submit-topic')}>Submit Topic</PrimaryButton><SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>Check My Topic</SecondaryButton></div>}
        />
      )}

      {!isLoading && !error && current && (
        <>
          <article className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3"><StatusBadge status={current.status || 'not_submitted'} /><span className="text-xs font-bold uppercase tracking-wider text-text-muted">Latest submission</span></div>
                <h2 className="mt-3 break-words text-xl font-bold leading-snug text-text-primary">{current.title}</h2>
                <p className="mt-2 break-words text-sm text-text-secondary">
                  {current.category || 'Uncategorised'} {' · '} Submitted {formatDate(current.submitted_at || current.created_at)}
                  {current.session_name ? ` · ${current.session_name}` : ''}
                  {current.keywords ? ` · Keywords: ${current.keywords}` : ''}
                </p>
              </div>
              {current.decision_reason && DECIDED_STATUSES.has(status) && <aside className="rounded-lg border border-feedback-warning-border bg-feedback-warning-bg p-4"><h3 className="text-xs font-bold uppercase text-feedback-warning">Lecturer feedback</h3><p className="mt-2 break-words text-sm leading-6 text-feedback-warning">{current.decision_reason}</p>{current.decided_at && <p className="mt-2 text-xs text-feedback-warning">Decision recorded {formatDate(current.decided_at)}</p>}</aside>}
            </div>
          </article>

          <section className="rounded-[10px] border border-emerald-100 bg-emerald-50 p-4 sm:px-5" aria-labelledby="next-step-title"><h2 id="next-step-title" className="text-xs font-bold uppercase tracking-wider text-brand-green-dark">What happens next</h2><p className="mt-2 text-sm text-text-secondary"><strong className="text-text-primary">{guidance.title}.</strong> {guidance.message}</p></section>

          <div className="flex flex-col gap-3 sm:flex-row">
            {status === 'awaiting_revision' ? (
              <>
                <PrimaryButton type="button" onClick={() => navigate('/student/submit-topic')}>Submit topic</PrimaryButton>
                <SecondaryButton type="button" onClick={() => navigate('/student/my-submissions')}>{guidance.action}</SecondaryButton>
              </>
            ) : (
              <PrimaryButton type="button" onClick={() => navigate('/student/my-submissions')}>{guidance.action}</PrimaryButton>
            )}
            <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>Check another topic</SecondaryButton>
          </div>

          <dl className="flex flex-wrap gap-2" aria-label="Submission summary"><div className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Total submissions</dt><dd className="ml-2 inline font-bold">{summary.total}</dd></div><div className="rounded-full border border-status-pending-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Pending</dt><dd className="ml-2 inline font-bold">{summary.pending}</dd></div><div className="rounded-full border border-status-revision-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Revision requested</dt><dd className="ml-2 inline font-bold">{summary.revision}</dd></div><div className="rounded-full border border-status-approved-bg bg-white px-3 py-1.5 text-sm"><dt className="inline font-semibold">Approved</dt><dd className="ml-2 inline font-bold">{summary.approved}</dd></div></dl>
        </>
      )}
    </StudentDashboardLayout>
  );
}

export default StudentDashboardPage;
