import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import FilterDropdown from '../../components/ui/FilterDropdown';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import { listLecturerDecisions } from '../../api/submissions';

const statusOptions = [
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Awaiting revision', value: 'awaiting_revision' }
];

const sortOptions = [
  { label: 'Decision date', value: 'decidedAt' },
  { label: 'Submitted date', value: 'submittedAt' },
  { label: 'Topic title', value: 'title' },
  { label: 'Status', value: 'status' },
  { label: 'Category', value: 'category' }
];

function formatDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function buildDecisionParams(filters) {
  return {
    page: filters.page,
    limit: 10,
    sort: filters.sort,
    direction: filters.direction,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.category.trim() ? { category: filters.category.trim() } : {})
  };
}

function SummaryCard({ helper, label, value, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'border-emerald-100 bg-white',
    success: 'border-emerald-100 bg-[#f5fbf2]',
    warning: 'border-amber-200 bg-[#fffaf0]'
  };

  return (
    <article className={`rounded-[1.2rem] border p-4 shadow-sm ${toneClasses[tone] || toneClasses.neutral}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1B5E20]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{helper}</p>
    </article>
  );
}

function DecisionCard({ decision }) {
  return (
    <article className="grid gap-4 px-5 py-5 transition-colors hover:bg-[#f7fbf4] lg:grid-cols-[minmax(0,1.35fr)_minmax(170px,0.75fr)_minmax(140px,0.55fr)_minmax(140px,0.55fr)_minmax(150px,0.55fr)] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <StatusBadge status={decision.status} />
          {decision.similaritySnapshotId ? (
            <span className="rounded-badge bg-white px-2.5 py-1 text-xs font-semibold text-text-muted ring-1 ring-inset ring-border-subtle">
              Snapshot #{decision.similaritySnapshotId}
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 font-semibold leading-snug text-text-primary lg:mt-0">{decision.title}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {decision.decisionFeedback || 'No lecturer rationale recorded.'}
        </p>
      </div>

      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted lg:hidden">
          Student
        </p>
        <p className="text-sm font-medium text-text-primary">{decision.studentName || 'Student not recorded'}</p>
        <p className="mt-1 break-all text-sm text-text-secondary">{decision.studentEmail || 'No email available'}</p>
      </div>

      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted lg:hidden">
          Category
        </p>
        <p className="text-sm text-text-secondary">{decision.category || 'Uncategorised'}</p>
      </div>

      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted lg:hidden">
          Decided
        </p>
        <p className="text-sm text-text-secondary">{formatDate(decision.decidedAt)}</p>
        <p className="mt-1 text-xs text-text-muted">Submitted {formatDate(decision.submittedAt)}</p>
      </div>

      <div className="hidden lg:block">
        <StatusBadge status={decision.status} />
        {decision.similaritySnapshotId ? (
          <p className="mt-2 text-xs font-semibold text-text-muted">Snapshot #{decision.similaritySnapshotId}</p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-text-muted">No snapshot linked</p>
        )}
      </div>
    </article>
  );
}

function MyDecisionsPage() {
  const [decisions, setDecisions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    direction: 'desc',
    page: 1,
    search: '',
    sort: 'decidedAt',
    status: ''
  });

  const loadDecisions = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await listLecturerDecisions(buildDecisionParams(filters));
      setDecisions(result.data?.items || []);
      setMeta(result.meta || null);
    } catch (err) {
      setDecisions([]);
      setMeta(null);
      setError(err.response?.data?.message || 'Unable to load lecturer decision history.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const totalDecisions = meta?.pagination?.total ?? decisions.length;
  const hasActiveFilters = Boolean(filters.search || filters.status || filters.category);

  const endpointMessage = useMemo(() => (
    meta?.dataCoverage || 'Read-only lecturer decision history from existing submissions.'
  ), [meta]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1
    }));
  }

  function clearFilters() {
    setFilters({
      category: '',
      direction: 'desc',
      page: 1,
      search: '',
      sort: 'decidedAt',
      status: ''
    });
  }

  function goToPage(nextPage) {
    setFilters((current) => ({
      ...current,
      page: nextPage
    }));
  }

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer records"
        title="My Decisions"
        subtitle="Read-only decision history connected to submissions you have already reviewed."
        action={(
          <Link
            to="/lecturer/dashboard"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Dashboard
          </Link>
        )}
      />

      {isLoading && <LoadingState label="Loading decision history" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load decision history"
          message={error}
          onRetry={loadDecisions}
        />
      )}

      {!isLoading && !error && (
        <>
          <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
            <div className="border-l-4 border-l-brand-gold bg-[linear-gradient(145deg,#f4fbef,#fffdf7)] p-5 sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                    Decision archive
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20]">
                    Real reviewed submissions
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                    Decisions are read from existing submissions where your lecturer account recorded the outcome.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1B5E20] shadow-sm">
                  Read-only history
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SummaryCard
                  helper="Reported by endpoint pagination metadata"
                  label="Decision records"
                  value={totalDecisions}
                  tone={totalDecisions > 0 ? 'success' : 'warning'}
                />
                <SummaryCard
                  helper="Rows returned for the current page"
                  label="Visible rows"
                  value={decisions.length}
                />
                <SummaryCard
                  helper="Exports, reports, and fake risk summaries stay unavailable"
                  label="Export status"
                  value="Deferred"
                  tone="warning"
                />
              </div>
            </div>
          </section>

          <InfoCallout
            title="Real decision data only"
            message={`${endpointMessage} This page does not fabricate decision rows, fake students, fake dates, risk scores, exports, reports, or activity.`}
          />

          <section className="rounded-[1.5rem] border border-emerald-100 bg-[#fbfdf8] p-5 shadow-card sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E20]">
                  History controls
                </p>
                <h2 className="text-xl font-semibold text-text-primary">Filter endpoint-backed decisions</h2>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
                API filters
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_140px]">
              <SearchInput
                id="decision-history-search"
                label="Search decisions"
                name="search"
                placeholder="Search topic, student, category, or email"
                value={filters.search}
                onChange={updateFilter}
              />
              <FilterDropdown
                id="decision-history-status"
                label="Status"
                name="status"
                placeholder="All outcomes"
                value={filters.status}
                options={statusOptions}
                onChange={updateFilter}
              />
              <SearchInput
                id="decision-history-category"
                label="Category"
                name="category"
                placeholder="Exact category"
                value={filters.category}
                onChange={updateFilter}
              />
              <FilterDropdown
                id="decision-history-sort"
                label="Sort"
                name="sort"
                value={filters.sort}
                options={sortOptions}
                onChange={updateFilter}
              />
              <FilterDropdown
                id="decision-history-direction"
                label="Direction"
                name="direction"
                value={filters.direction}
                options={[
                  { label: 'Newest', value: 'desc' },
                  { label: 'Oldest', value: 'asc' }
                ]}
                onChange={updateFilter}
              />
            </div>

            {hasActiveFilters ? (
              <div className="mt-4">
                <SecondaryButton type="button" onClick={clearFilters}>
                  Clear Filters
                </SecondaryButton>
              </div>
            ) : null}
          </section>

          {decisions.length === 0 ? (
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
              <EmptyStatePanel
                title="No decisions returned"
                message="The decision-history endpoint returned no records for the current filters. No placeholder decisions are shown."
                action={(
                  <SecondaryButton type="button" onClick={loadDecisions}>
                    Refresh History
                  </SecondaryButton>
                )}
              />
            </section>
          ) : (
            <section className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-card">
              <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E20]">
                    My decision history
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-text-primary">Reviewed submissions</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Open the pending-review workflow for new decisions; this page only reads completed decision records.
                  </p>
                </div>
                <SecondaryButton type="button" onClick={loadDecisions}>
                  Refresh History
                </SecondaryButton>
              </div>

              <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(170px,0.75fr)_minmax(140px,0.55fr)_minmax(140px,0.55fr)_minmax(150px,0.55fr)] gap-4 bg-[#f6fbf1] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted lg:grid">
                <span>Topic and rationale</span>
                <span>Student</span>
                <span>Category</span>
                <span>Decision date</span>
                <span>Status</span>
              </div>

              <div className="divide-y divide-border-subtle">
                {decisions.map((decision) => (
                  <DecisionCard decision={decision} key={decision.id} />
                ))}
              </div>
            </section>
          )}

          {meta?.pagination ? (
            <nav
              aria-label="Decision history pagination"
              className="flex flex-col gap-3 rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-text-secondary shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                Page {meta.pagination.page} of {meta.pagination.totalPages || 0}. Total records: {meta.pagination.total}.
              </span>
              <div className="flex gap-2">
                <SecondaryButton
                  type="button"
                  disabled={!meta.pagination.hasPreviousPage}
                  onClick={() => goToPage(Math.max(1, meta.pagination.page - 1))}
                >
                  Previous
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!meta.pagination.hasNextPage}
                  onClick={() => goToPage(meta.pagination.page + 1)}
                >
                  Next
                </SecondaryButton>
              </div>
            </nav>
          ) : null}

          <InfoCallout
            title="Still out of scope"
            message="Decision exports, report downloads, fake similarity scores, analytics, and supervisor assignment claims are not connected here."
            variant="warning"
          />
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default MyDecisionsPage;
