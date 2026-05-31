import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLecturerPendingSubmissions } from '../../api/submissions';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import FilterDropdown from '../../components/ui/FilterDropdown';
import InfoCallout from '../../components/ui/InfoCallout';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SearchInput from '../../components/ui/SearchInput';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import TableShell from '../../components/ui/TableShell';

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

  if (!normalizedQuery) {
    return true;
  }

  return [
    submission.title,
    submission.student_name,
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

  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((submission) => !categoryFilter || submission.category === categoryFilter)
      .filter((submission) => matchesSearch(submission, searchTerm))
      .sort((first, second) => {
        const firstTimestamp = getSubmittedTimestamp(first);
        const secondTimestamp = getSubmittedTimestamp(second);

        return sortOrder === 'newest'
          ? secondTimestamp - firstTimestamp
          : firstTimestamp - secondTimestamp;
      });
  }, [categoryFilter, searchTerm, sortOrder, submissions]);

  const hasActiveFilters = Boolean(searchTerm || categoryFilter);

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer Queue"
        title="Pending Reviews"
        subtitle="Browse submitted student topics waiting for lecturer review. Decisions stay in the existing detail workflow."
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
          <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-48px_rgb(4_120_87_/_0.5)]">
            <div className="border-l-4 border-l-brand-gold bg-[linear-gradient(145deg,#f6fbf1,#fffdf7)] p-5 sm:p-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                    Queue overview
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight text-text-primary">
                    Pending Reviews
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                    Review loaded student submissions without queue-level decisions or unsupported workflow shortcuts.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
                  Read-only loaded queue
                </span>
              </div>

              <div className="mt-6 rounded-[1.15rem] bg-white/75 p-1 shadow-inner">
                <div className="grid gap-1 sm:grid-cols-2">
                  <div className="rounded-[0.95rem] bg-brand-green px-4 py-3 text-center text-sm font-semibold text-white">
                    Loaded queue ({submissions.length})
                  </div>
                  <div className="rounded-[0.95rem] px-4 py-3 text-center text-sm font-semibold text-text-secondary">
                    Visible after filters ({filteredSubmissions.length})
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <DashboardStatusCard
                  label="Pending Reviews"
                  value={submissions.length}
                  helper="Loaded from the existing lecturer pending submissions API"
                />
                <DashboardStatusCard
                  label="Visible After Filters"
                  value={filteredSubmissions.length}
                  helper="Calculated locally from the loaded queue"
                />
                <DashboardStatusCard
                  label="Similarity Summary"
                  value="Not connected yet"
                  helper="Risk labels and score summaries are not returned for this queue"
                />
              </div>
            </div>
          </section>

          <InfoCallout
            title="Read-only queue"
            message="Open a submission to review details and record a decision. This queue does not approve, reject, request revision, run similarity checks, or save snapshots."
          />

          {submissions.length === 0 && (
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
              <EmptyStatePanel
                title="No pending reviews"
                message="Student submissions with pending review status will appear here when they are ready for lecturer action."
                action={(
                  <SecondaryButton type="button" onClick={loadSubmissions}>
                    Refresh Queue
                  </SecondaryButton>
                )}
              />
            </section>
          )}

          {submissions.length > 0 && (
            <>
              <section className="rounded-[1.5rem] border border-emerald-100 bg-[#fbfdf8] p-5 shadow-card sm:p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                      Queue controls
                    </p>
                    <h2 className="text-xl font-semibold text-text-primary">Search and sort loaded reviews</h2>
                  </div>
                  <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Client-side only
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px]">
                  <SearchInput
                    id="pending-review-search"
                    label="Search queue"
                    placeholder="Search topic, student, category, keywords, or session"
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
                <p className="mt-3 text-sm text-text-muted">
                  Search, filter, and sort are client-side only and use the already-loaded queue data.
                </p>
              </section>

              {filteredSubmissions.length === 0 && (
                <EmptyStatePanel
                  title="No matching pending reviews"
                  message="No loaded submissions match the current search or category filter. Clear the controls to return to the full queue."
                  action={(
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('');
                      }}
                    >
                      Clear Filters
                    </SecondaryButton>
                  )}
                />
              )}

              {filteredSubmissions.length > 0 && (
                <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-2 shadow-card">
                  <TableShell
                    className="rounded-[1.15rem]"
                    title="Review Queue"
                    subtitle="Open a row to continue in the existing submission detail workflow."
                    actions={(
                      <PrimaryButton type="button" onClick={loadSubmissions}>
                        Refresh Queue
                      </PrimaryButton>
                    )}
                  >
                  <table className="min-w-full divide-y divide-border-subtle">
                    <thead className="bg-[#f6fbf1]">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Topic
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Student
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Category
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Submitted
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-white">
                      {filteredSubmissions.map((submission) => (
                        <tr key={submission.id} className="align-top transition-colors hover:bg-[#f7fbf4]">
                          <td className="px-4 py-4">
                            <p className="font-semibold leading-snug text-text-primary">{submission.title}</p>
                            {submission.keywords && (
                              <p className="mt-1 text-sm text-text-secondary">Keywords: {submission.keywords}</p>
                            )}
                            {submission.session_name && (
                              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                {submission.session_name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium text-text-primary">
                              {submission.student_name || 'Unnamed student'}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {submission.student_email || 'No email available'}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {submission.category || 'Uncategorised'}
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {formatDate(submission.submitted_at || submission.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={submission.status} />
                          </td>
                          <td className="px-4 py-4">
                            <SecondaryButton
                              type="button"
                              onClick={() => navigate(`/lecturer/pending-reviews/${submission.id}`)}
                            >
                              Open Review
                            </SecondaryButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </TableShell>
                </div>
              )}

              <InfoCallout
                title="Not connected yet"
                message="Queue ownership, bulk tools, score summaries, and advanced list controls require data that is not available from the current pending submissions API."
                variant={hasActiveFilters ? 'info' : 'warning'}
              />
            </>
          )}
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default PendingReviewsPage;
