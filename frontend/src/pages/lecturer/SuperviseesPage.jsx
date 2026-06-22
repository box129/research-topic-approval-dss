import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import { listLecturerSupervisees } from '../../api/submissions';

const statusLabels = {
  approved: 'Approved',
  awaiting_revision: 'Awaiting revision',
  pending_review: 'Pending review',
  rejected: 'Rejected'
};

function formatDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function SuperviseeCard({ assignment }) {
  const latestSubmission = assignment.latestSubmission;

  return (
    <article className="rounded-[1.35rem] border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            Active assignment
          </span>
          <h2 className="mt-3 text-lg font-semibold text-[#1B5E20]">{assignment.student?.name || 'Unnamed student'}</h2>
          <p className="mt-1 break-all text-sm text-text-secondary">{assignment.student?.email || 'Email unavailable'}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Assigned {formatDate(assignment.assignedAt)}
          </p>
        </div>

        <div className="rounded-[1rem] border border-emerald-100 bg-[#fbfdf8] p-3 lg:w-80">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Latest real submission</p>
          {latestSubmission ? (
            <div className="mt-2">
              <p className="text-sm font-semibold leading-5 text-text-primary">{latestSubmission.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary shadow-sm">
                  {latestSubmission.category || 'No category'}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {statusLabels[latestSubmission.status] || latestSubmission.status || 'Unknown status'}
                </span>
              </div>
              <p className="mt-3 text-xs text-text-muted">
                Submitted {formatDate(latestSubmission.submittedAt)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-5 text-text-secondary">
              No submission record is attached to this supervisee yet.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function SuperviseesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadSupervisees() {
    setPageState('loading');
    setErrorMessage('');

    try {
      const result = await listLecturerSupervisees();
      setItems(result.data?.items || []);
      setMeta(result.meta || null);
      setPageState('success');
    } catch (error) {
      setItems([]);
      setMeta(null);
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
        if (!isMounted) {
          return;
        }
        setItems(result.data?.items || []);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setItems([]);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'Supervisee assignments could not be loaded.');
        setPageState('error');
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    return items.reduce((totals, assignment) => {
      const latestStatus = assignment.latestSubmission?.status || 'no_submission';
      return {
        ...totals,
        total: totals.total + 1,
        withSubmission: totals.withSubmission + (assignment.latestSubmission ? 1 : 0),
        [latestStatus]: (totals[latestStatus] || 0) + 1
      };
    }, {
      total: 0,
      withSubmission: 0
    });
  }, [items]);

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer supervision"
        title="Supervisees"
        subtitle="Read-only assigned supervisees from real lecturer-supervisee assignment records. Reviewed submissions are not treated as supervisee assignments."
        action={(
          <Link
            to="/lecturer/dashboard"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Dashboard
          </Link>
        )}
      />

      <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
        <div className="bg-[linear-gradient(145deg,#f4fbef,#fffdf7)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                Assignment source: {meta?.assignmentSource || 'LecturerSuperviseeAssignment'}
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20]">
                Real assigned supervisees only.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                This page lists active assignments owned by your lecturer account. It does not infer supervision from reviewed submissions, similarity checks, or dashboard activity.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              {isLoading ? 'Loading assignments' : `${summary.total} assigned`}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-[1rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Assigned students</p>
              <p className="mt-2 text-2xl font-semibold text-[#1B5E20]">{isLoading ? '...' : summary.total}</p>
            </article>
            <article className="rounded-[1rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">With submissions</p>
              <p className="mt-2 text-2xl font-semibold text-[#1B5E20]">{isLoading ? '...' : summary.withSubmission}</p>
            </article>
            <article className="rounded-[1rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Pending review</p>
              <p className="mt-2 text-2xl font-semibold text-[#1B5E20]">{isLoading ? '...' : (summary.pending_review || 0)}</p>
            </article>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-7">
          {hasError ? (
            <div className="rounded-[1.25rem] border border-amber-100 bg-amber-50 p-4">
              <InfoCallout
                title="Supervisee assignments unavailable"
                message={`${errorMessage} No fallback supervisee rows are displayed.`}
                variant="warning"
              />
              <button
                type="button"
                onClick={loadSupervisees}
                className="mt-3 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
              >
                Retry
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-[1.35rem] border border-emerald-100 bg-[#fbfdf8]" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasError && items.length === 0 ? (
            <EmptyStatePanel
              title="No assigned supervisees returned"
              message="The supervisee endpoint returned an empty list. No fake supervisees, progress rows, or sample students are shown."
            />
          ) : null}

          {!isLoading && !hasError && items.length > 0 ? (
            <div className="space-y-3">
              {items.map((assignment) => (
                <SuperviseeCard assignment={assignment} key={assignment.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default SuperviseesPage;
