import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLecturerPendingSubmissions } from '../../api/submissions';
import ErrorState from '../../components/ui/ErrorState';
import FilterDropdown from '../../components/ui/FilterDropdown';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SearchInput from '../../components/ui/SearchInput';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentIdentity from '../../components/ui/StudentIdentity';

function formatDate(value) {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not submitted';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function getSubmittedTimestamp(submission) {
  const rawDate = submission?.submitted_at || submission?.created_at;
  const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesSearch(submission, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  return [
    submission.title,
    submission.student_name,
    submission.student_matric_number,
    submission.student_email,
    submission.category,
    submission.keywords,
    submission.session_name
  ].some((value) => normalizeText(value).includes(normalizedQuery));
}

function buildCategoryOptions(submissions) {
  return [...new Set(submissions.map((submission) => submission.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => ({ label: category, value: category }));
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

function PendingReviewsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('oldest');

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSubmissions(await listLecturerPendingSubmissions());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load pending reviews.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const categoryOptions = useMemo(() => buildCategoryOptions(submissions), [submissions]);
  const filteredSubmissions = useMemo(() => submissions
    .filter((submission) => !categoryFilter || submission.category === categoryFilter)
    .filter((submission) => matchesSearch(submission, searchTerm))
    .sort((first, second) => {
      const firstTimestamp = getSubmittedTimestamp(first);
      const secondTimestamp = getSubmittedTimestamp(second);
      return sortOrder === 'newest'
        ? secondTimestamp - firstTimestamp
        : firstTimestamp - secondTimestamp;
    }), [categoryFilter, searchTerm, sortOrder, submissions]);

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer queue"
        title="Pending Reviews"
        subtitle="Browse submitted student topics waiting for lecturer review."
        action={(
          <SecondaryButton type="button" onClick={() => navigate('/lecturer/dashboard')}>
            Back to Dashboard
          </SecondaryButton>
        )}
      />

      {isLoading && <LoadingState label="Loading pending reviews" />}
      {!isLoading && error && (
        <ErrorState
          title="Could not load pending reviews"
          message={error}
          onRetry={loadSubmissions}
        />
      )}

      {!isLoading && !error && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Review queue summary">
            <SummaryChip label="Pending reviews" value={submissions.length} warning={submissions.length > 0} />
            <SummaryChip label="Visible after filters" value={filteredSubmissions.length} />
          </div>

          {submissions.length === 0 ? (
            /* C4a — genuine empty: nothing is currently waiting for review.
               The message sits left-aligned where the first row would appear,
               inside the queue shell. Absence of records, never absence of
               similarity — and no failure or filter language. */
            <section data-testid="pending-empty" className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
              <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-text-primary">Review queue</h2>
                <SecondaryButton type="button" onClick={loadSubmissions}>
                  Refresh Queue
                </SecondaryButton>
              </div>
              <div className="px-5 py-6">
                <h3 className="text-base font-semibold text-text-primary">No pending reviews</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                  No submissions are currently waiting for your review. Newly submitted topics assigned to you will appear here.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <SecondaryButton type="button" className="min-h-11" onClick={() => navigate('/lecturer/my-decisions')}>
                    View my decisions
                  </SecondaryButton>
                  <SecondaryButton type="button" className="min-h-11" onClick={() => navigate('/lecturer/supervisees')}>
                    View supervisees
                  </SecondaryButton>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
                <h2 className="mb-4 text-base font-bold text-text-primary">Find a review</h2>
                <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px]">
                  <SearchInput
                    id="pending-review-search"
                    label="Search queue"
                    placeholder="Topic, student, category, keywords, or session"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  <FilterDropdown
                    id="pending-review-category"
                    label="Category"
                    placeholder="All categories"
                    value={categoryFilter}
                    options={categoryOptions}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  />
                  <FilterDropdown
                    id="pending-review-sort"
                    label="Sort"
                    value={sortOrder}
                    options={[
                      { label: 'Oldest submitted', value: 'oldest' },
                      { label: 'Newest submitted', value: 'newest' }
                    ]}
                    onChange={(event) => setSortOrder(event.target.value)}
                  />
                </div>
              </section>

              {filteredSubmissions.length === 0 ? (
                /* C4b — filtered empty: records exist but none satisfy the
                   current filters. The user's own filter is the cause, so
                   reversing it is the primary action. The hidden count is
                   truthful because the full pending collection is loaded and
                   filtered locally — submissions.length is the real pre-filter
                   total, not a backend aggregation claim. Sort is not a filter
                   and is never reset here. */
                <section data-testid="pending-filtered-empty" className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
                  <div className="flex flex-col gap-2 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-bold text-text-primary">Review queue</h2>
                    <p className="text-sm text-text-secondary">
                      {submissions.length} pending review{submissions.length === 1 ? '' : 's'} · 0 shown
                    </p>
                  </div>
                  <div className="px-5 py-6">
                    {(searchTerm.trim() || categoryFilter) && (
                      <div className="flex flex-wrap gap-2" aria-label="Active filters">
                        {searchTerm.trim() && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            aria-label={`Remove search filter ${searchTerm.trim()}`}
                            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border-strong bg-white px-3 text-sm text-text-primary transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:ring-offset-2"
                          >
                            Search: “{searchTerm.trim()}” <span aria-hidden="true">×</span>
                          </button>
                        )}
                        {categoryFilter && (
                          <button
                            type="button"
                            onClick={() => setCategoryFilter('')}
                            aria-label={`Remove category filter ${categoryFilter}`}
                            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border-strong bg-white px-3 text-sm text-text-primary transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:ring-offset-2"
                          >
                            Category: {categoryFilter} <span aria-hidden="true">×</span>
                          </button>
                        )}
                      </div>
                    )}
                    <h3 className="mt-4 text-base font-semibold text-text-primary">No pending reviews match these filters.</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                      Submissions may be waiting for your review but excluded by the search term or category above. Clear or change the filters to see them.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <PrimaryButton
                        type="button"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => {
                          setSearchTerm('');
                          setCategoryFilter('');
                        }}
                      >
                        Clear all filters
                      </PrimaryButton>
                      {searchTerm.trim() && <p className="text-sm text-text-secondary">Or adjust the search term above.</p>}
                    </div>
                    <div className="mt-5 border-t border-dashed border-border-strong pt-3">
                      <p data-testid="hidden-count" className="text-sm text-text-secondary">
                        {submissions.length === 1
                          ? '1 submission is pending review but hidden by these filters.'
                          : `${submissions.length} submissions are pending review but hidden by these filters.`}
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
                  <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-bold text-text-primary">Review queue</h2>
                    <PrimaryButton type="button" onClick={loadSubmissions}>Refresh Queue</PrimaryButton>
                  </div>

                  <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(150px,0.8fr)_minmax(110px,0.55fr)_minmax(120px,0.55fr)_minmax(120px,0.5fr)_auto] gap-4 bg-surface-muted px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted lg:grid">
                    <span>Topic</span>
                    <span>Student</span>
                    <span>Category</span>
                    <span>Submitted</span>
                    <span>Status</span>
                    <span>Action</span>
                  </div>

                  <div className="divide-y divide-border-subtle">
                    {filteredSubmissions.map((submission) => (
                      <article
                        key={submission.id}
                        className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(150px,0.8fr)_minmax(110px,0.55fr)_minmax(120px,0.55fr)_minmax(120px,0.5fr)_auto] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="lg:hidden"><StatusBadge status={submission.status} /></div>
                          {submission.is_revision && (
                            <p
                              className="mt-2 inline-flex rounded-badge bg-status-revision-bg px-2 py-0.5 text-xs font-semibold text-status-revision lg:mt-0"
                              data-testid={`queue-revision-marker-${submission.id}`}
                            >
                              Revised submission
                            </p>
                          )}
                          <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-text-primary lg:mt-0">
                            {submission.title}
                          </h3>
                          {submission.revision_of?.decision_reason && (
                            <p className="mt-1 break-words text-xs leading-5 text-text-muted">
                              <span className="font-semibold">Revision requested:</span> {submission.revision_of.decision_reason}
                            </p>
                          )}
                          {submission.keywords && (
                            <p className="mt-1 break-words text-sm text-text-secondary">Keywords: {submission.keywords}</p>
                          )}
                          {submission.session_name && (
                            <p className="mt-1 text-xs text-text-muted">{submission.session_name}</p>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Student</p>
                          <StudentIdentity
                            name={submission.student_name}
                            matricNumber={submission.student_matric_number}
                            email={submission.student_email}
                            testIdPrefix={`queue-student-${submission.id}`}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Category</p>
                          <p className="break-words text-sm text-text-secondary">
                            {submission.category || 'Uncategorised'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-text-muted lg:hidden">Submitted</p>
                          <p className="text-sm text-text-secondary">
                            {formatDate(submission.submitted_at || submission.created_at)}
                          </p>
                        </div>
                        <div className="hidden lg:block"><StatusBadge status={submission.status} /></div>
                        <SecondaryButton
                          type="button"
                          className="w-full lg:w-auto"
                          onClick={() => navigate(`/lecturer/pending-reviews/${submission.id}`)}
                        >
                          Open Review
                        </SecondaryButton>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default PendingReviewsPage;
