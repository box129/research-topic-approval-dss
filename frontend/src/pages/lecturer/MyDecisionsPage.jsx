import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import FilterDropdown from '../../components/ui/FilterDropdown';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentIdentity from '../../components/ui/StudentIdentity';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import { listLecturerDecisions } from '../../api/submissions';

const statusOptions = [
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  // User-facing workflow vocabulary; the API parameter value is unchanged.
  { label: 'Revision requested', value: 'awaiting_revision' }
];

const sortOptions = [
  { label: 'Decision date', value: 'decidedAt' },
  { label: 'Submitted date', value: 'submittedAt' },
  { label: 'Topic title', value: 'title' },
  { label: 'Status', value: 'status' },
  { label: 'Category', value: 'category' }
];

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
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

function SummaryChip({ label, value }) {
  return (
    <p className="w-fit rounded-full border border-border-subtle bg-white px-3 py-1 text-sm font-semibold text-text-secondary">
      {label} <span className="ml-1 text-text-primary">{value}</span>
    </p>
  );
}

// One shared definition for the desktop header and every row, so the two can
// never drift. The student column fits a full personal email; the final column
// fits "Latest saved similarity check #NN" without treating provenance as a
// broken narrow metadata column; the fluid topic column absorbs the rest.
const DECISIONS_GRID_COLS = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.9fr)_minmax(120px,0.55fr)_minmax(140px,0.6fr)_minmax(220px,0.75fr)]';

function DecisionRecord({ decision }) {
  return (
    <article className={`grid gap-4 px-5 py-4 ${DECISIONS_GRID_COLS} lg:items-center`}>
      <div className="min-w-0">
        {/* D2 record grammar: topic identity first; the workflow pill follows
            it on mobile (desktop keeps the dedicated status column); the
            lecturer rationale reads directly after the status. */}
        <h3 className="break-words text-sm font-semibold leading-5 text-text-primary">
          {decision.title}
        </h3>
        <div className="mt-2 lg:hidden"><StatusBadge status={decision.status} /></div>
        <p className="mt-2 break-words text-sm text-text-secondary lg:mt-1">
          {decision.decisionFeedback || 'No lecturer rationale recorded.'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Student</p>
        <StudentIdentity
          name={decision.studentName}
          matricNumber={decision.studentMatricNumber}
          email={decision.studentEmail}
          testIdPrefix={`decision-${decision.id}-student`}
        />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Category</p>
        <p className="break-words text-sm text-text-secondary">{decision.category || 'Uncategorised'}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Decided</p>
        <p className="text-sm text-text-secondary">{formatDate(decision.decidedAt)}</p>
        <p className="mt-1 text-xs text-text-muted">Submitted {formatDate(decision.submittedAt)}</p>
      </div>
      <div className="hidden lg:block">
        <StatusBadge status={decision.status} />
        {/* N-1 provenance ceiling (Board B): no persisted decision↔snapshot
            relation exists. This id is the latest saved check available at
            read time — independent technical metadata, never evidence "linked
            to" or "used for" the decision. */}
        <p className="mt-2 text-xs text-text-muted">
          {decision.similaritySnapshotId
            ? `Latest saved similarity check #${decision.similaritySnapshotId}`
            : 'No saved similarity check'}
        </p>
      </div>
      {/* Mobile carries the same truthful meaning as the desktop column —
          including the absence wording. A silent branch would drop the
          "no saved check" fact at 390px. */}
      <p className="text-xs text-text-muted lg:hidden">
        {decision.similaritySnapshotId
          ? `Latest saved similarity check #${decision.similaritySnapshotId}`
          : 'No saved similarity check'}
      </p>
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

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));
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
    setFilters((current) => ({ ...current, page: nextPage }));
  }

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer records"
        title="My Decisions"
        subtitle="Review completed decisions recorded for submissions you assessed."
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
        <ErrorState title="Could not load decision history" message={error} onRetry={loadDecisions} />
      )}

      {!isLoading && !error && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Decision history summary">
            <SummaryChip label="Decision records" value={totalDecisions} />
            <SummaryChip label="Visible rows" value={decisions.length} />
          </div>

          <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
            <h2 className="mb-4 text-base font-bold text-text-primary">Filter decisions</h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_140px]">
              <SearchInput
                id="decision-history-search"
                label="Search decisions"
                name="search"
                placeholder="Topic, student, matric number, category, or email"
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
            {hasActiveFilters && (
              <div className="mt-4">
                <SecondaryButton type="button" onClick={clearFilters}>Clear Filters</SecondaryButton>
              </div>
            )}
          </section>

          {decisions.length === 0 ? (
            <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
              {/* Board C empty-state taxonomy: a zero-result page with no active
                  filter is a genuinely empty history and must never blame
                  filters; with an active filter the copy names the filters and
                  offers a direct way out. Server-side filtering means the
                  client's own filter state is the distinguishing signal. */}
              {hasActiveFilters ? (
                /* The filter card above already shows its Clear Filters button
                   whenever a filter is active, so the panel carries no second
                   copy of the same action. */
                <EmptyStatePanel
                  title="No decisions match these filters"
                  message="Try adjusting or clearing the current filters."
                />
              ) : (
                <EmptyStatePanel
                  title="No decisions recorded yet"
                  message="Completed decisions you record will appear here."
                  action={(
                    <SecondaryButton type="button" onClick={loadDecisions}>Refresh History</SecondaryButton>
                  )}
                />
              )}
            </section>
          ) : (
            <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
              <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-text-primary">Reviewed submissions</h2>
                <SecondaryButton type="button" onClick={loadDecisions}>Refresh History</SecondaryButton>
              </div>
              <div className={`hidden gap-4 bg-surface-muted px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted lg:grid ${DECISIONS_GRID_COLS}`}>
                <span>Topic and rationale</span>
                <span>Student</span>
                <span>Category</span>
                <span>Decision date</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {decisions.map((decision) => (
                  <DecisionRecord decision={decision} key={decision.id} />
                ))}
              </div>
            </section>
          )}

          {meta?.pagination && (
            <nav
              aria-label="Decision history pagination"
              className="flex flex-col gap-3 rounded-[10px] border border-border-subtle bg-white px-4 py-3 text-sm text-text-secondary shadow-card sm:flex-row sm:items-center sm:justify-between"
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
          )}
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default MyDecisionsPage;
