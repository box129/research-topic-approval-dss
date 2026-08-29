import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentIdentity from '../../components/ui/StudentIdentity';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import { listLecturerSupervisees } from '../../api/submissions';

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function SummaryChip({ label, value, warning = false }) {
  return (
    <p className={`w-fit rounded-full border px-3 py-1 text-sm font-semibold ${
      warning
        ? 'border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning'
        : 'border-border-subtle bg-white text-text-secondary'
    }`}>
      {label} <span className="ml-1 text-text-primary">{value}</span>
    </p>
  );
}

function SuperviseeRecord({ assignment }) {
  const latestSubmission = assignment.latestSubmission;

  return (
    <article className="grid gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Active assignment</p>
        <div className="mt-2">
          <StudentIdentity
            name={assignment.student?.name}
            matricNumber={assignment.student?.matricNumber}
            email={assignment.student?.email}
            testIdPrefix={`supervisee-${assignment.id}-student`}
          />
        </div>
        <p className="mt-2 text-sm text-text-muted">Assigned {formatDate(assignment.assignedAt)}</p>
      </div>

      <div className="rounded-[8px] border border-border-subtle bg-surface-page p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest submission</p>
        {latestSubmission ? (
          <>
            <p className="mt-2 break-words text-sm font-semibold leading-5 text-text-primary">
              {latestSubmission.title}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={latestSubmission.status} />
              <span className="text-sm text-text-secondary">
                {latestSubmission.category || 'No category'}
              </span>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Submitted {formatDate(latestSubmission.submittedAt)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-5 text-text-secondary">
            No submission record is attached to this supervisee yet.
          </p>
        )}
      </div>
    </article>
  );
}

function SuperviseesPage() {
  const [items, setItems] = useState([]);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadSupervisees() {
    setPageState('loading');
    setErrorMessage('');
    try {
      const result = await listLecturerSupervisees();
      setItems(result.data?.items || []);
      setPageState('success');
    } catch (error) {
      setItems([]);
      setErrorMessage(error?.response?.data?.error?.message || 'Supervisee assignments could not be loaded.');
      setPageState('error');
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      setPageState('loading');
      setErrorMessage('');
      try {
        const result = await listLecturerSupervisees();
        if (!isMounted) return;
        setItems(result.data?.items || []);
        setPageState('success');
      } catch (error) {
        if (!isMounted) return;
        setItems([]);
        setErrorMessage(error?.response?.data?.error?.message || 'Supervisee assignments could not be loaded.');
        setPageState('error');
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => items.reduce((totals, assignment) => ({
    total: totals.total + 1,
    withSubmission: totals.withSubmission + (assignment.latestSubmission ? 1 : 0),
    pendingReview: totals.pendingReview + (assignment.latestSubmission?.status === 'pending_review' ? 1 : 0)
  }), { total: 0, withSubmission: 0, pendingReview: 0 }), [items]);

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer supervision"
        title="Supervisees"
        subtitle="View students currently assigned to you for supervision."
        action={(
          <Link
            to="/lecturer/dashboard"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Dashboard
          </Link>
        )}
      />

      {isLoading && <LoadingState label="Loading supervisees" />}
      {!isLoading && hasError && (
        <ErrorState
          title="Supervisee assignments unavailable"
          message={errorMessage}
          onRetry={loadSupervisees}
        />
      )}

      {!isLoading && !hasError && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Supervisee summary">
            <SummaryChip label="Assigned students" value={summary.total} />
            <SummaryChip label="With submissions" value={summary.withSubmission} />
            <SummaryChip label="Pending review" value={summary.pendingReview} warning={summary.pendingReview > 0} />
          </div>

          {items.length === 0 ? (
            <EmptyStatePanel
              title="No assigned supervisees"
              message="No students are currently assigned to you."
            />
          ) : (
            <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
              <h2 className="border-b border-border-subtle px-5 py-4 text-base font-bold text-text-primary">
                Assigned students
              </h2>
              {items.map((assignment) => (
                <SuperviseeRecord assignment={assignment} key={assignment.id} />
              ))}
            </section>
          )}
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default SuperviseesPage;
