import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLecturerPendingSubmissions } from '../../api/submissions';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

function formatDate(value) {
  if (!value) {
    return 'Not available yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available yet';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function DashboardSummaryCard({ badge, helper, label, tone = 'neutral', value }) {
  const toneClasses = {
    neutral: 'border-emerald-100 bg-white',
    success: 'border-emerald-100 bg-[#f5fbf2]',
    warning: 'border-amber-200 bg-[#fffaf0]',
    muted: 'border-slate-200 bg-white/75'
  };

  const valueClass = typeof value === 'number'
    ? 'text-4xl font-semibold text-[#1B5E20]'
    : 'text-xl font-semibold leading-tight text-text-primary';

  return (
    <article className={`rounded-[1.35rem] border p-4 shadow-sm ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
        {badge && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#1B5E20] shadow-sm">
            {badge}
          </span>
        )}
      </div>
      <p className={`mt-4 ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{helper}</p>
    </article>
  );
}

function LecturerDashboardPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setSubmissions(await listLecturerPendingSubmissions());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load lecturer dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const previewSubmissions = useMemo(() => submissions.slice(0, 3), [submissions]);

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer Portal"
        title="Lecturer Dashboard"
        subtitle="Triage pending topic reviews and jump into the existing lecturer review workflow."
        action={(
          <SecondaryButton type="button" onClick={() => navigate('/lecturer/check-similarity')}>
            Check Similarity
          </SecondaryButton>
        )}
      />

      {isLoading && <LoadingState label="Loading lecturer dashboard" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load lecturer dashboard"
          message={error}
          onRetry={loadDashboard}
        />
      )}

      {!isLoading && !error && (
        <>
          <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.34fr)]">
              <div className="bg-[linear-gradient(145deg,#f4fbef,#fffdf7)] p-5 sm:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                      Dashboard
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20] sm:text-4xl">
                      Welcome back to your review desk.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                      Triage the existing pending-review queue and keep unsupported dashboard analytics clearly marked as unavailable.
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1B5E20] shadow-sm">
                    Existing queue API
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-2" aria-label="Lecturer review workflow">
                  {[
                    'Review assigned topics',
                    'Open submission details',
                    'Decide in controlled workflow'
                  ].map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-emerald-100 bg-white/85 px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-sm"
                    >
                      {step}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <DashboardSummaryCard
                    badge={submissions.length > 0 ? 'Action required' : 'All caught up'}
                    label="Pending Reviews"
                    value={submissions.length}
                    helper="Loaded from the existing pending review queue"
                    tone={submissions.length > 0 ? 'warning' : 'success'}
                  />
                  <DashboardSummaryCard
                    badge="Unavailable"
                    label="Risk Summary"
                    value="Not available yet"
                    helper="Risk summaries are not connected to the dashboard"
                    tone="warning"
                  />
                  <DashboardSummaryCard
                    badge="Endpoint needed"
                    label="Decision Metrics"
                    value="Not available yet"
                    helper="Approved, rejected, and revision counts need a dashboard endpoint"
                    tone="muted"
                  />
                </div>

                <div className="mt-4 rounded-[1.15rem] border border-dashed border-emerald-100 bg-white/75 p-4 text-sm leading-6 text-text-secondary">
                  <span className="font-semibold text-text-primary">Recent Activity:</span>{' '}
                  Not connected yet. Activity-feed and recent-decision data are not available from the current API.
                </div>
              </div>

              <aside className="border-t border-emerald-100 p-5 sm:p-7 xl:border-l xl:border-t-0">
                <div className="rounded-[1.25rem] border border-emerald-100 border-l-4 border-l-brand-gold bg-[#fbfdf8] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E20]">
                    Quick actions
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-primary">Move through reviews</h2>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                    Open the queue for review details or run an advisory similarity check separately.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <PrimaryButton type="button" onClick={() => navigate('/lecturer/pending-reviews')}>
                      Open Pending Queue
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => navigate('/lecturer/check-similarity')}>
                      Open Similarity Checker
                    </SecondaryButton>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-dashed border-brand-green-light bg-[#f6fbf1] p-4 text-sm leading-6 text-text-secondary">
                  <p className="font-semibold text-text-primary">Dashboard scope</p>
                  <p className="mt-2">
                    Workload, trend, and activity cards stay unavailable until a safe dashboard endpoint exists.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <InfoCallout
            title="Dashboard data limits"
            message="This dashboard uses only the existing pending review queue. Similarity risk, activity, workload, and trend analytics are shown as unavailable until a safe dashboard API exists."
          />

          <section className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_18px_55px_-35px_rgb(4_120_87_/_0.45)]">
            <div className="border-b border-border-subtle bg-[linear-gradient(135deg,#fbfff7,#fffdf7)] p-5 sm:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E20]">
                    Review queue preview
                  </p>
                  <h2 className="text-xl font-bold text-text-primary">Pending Review Queue</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                  Review the oldest pending submissions first, or open the full queue for the complete table.
                  </p>
                </div>
                <PrimaryButton type="button" onClick={() => navigate('/lecturer/pending-reviews')}>
                  View All Pending Reviews
                </PrimaryButton>
              </div>
            </div>

            {submissions.length === 0 && (
              <div className="p-5 sm:p-7">
                <EmptyStatePanel
                  title="No pending reviews"
                  message="Student submissions with pending review status will appear here when they are ready for lecturer action."
                  action={(
                    <SecondaryButton type="button" onClick={() => navigate('/lecturer/pending-reviews')}>
                      Open Pending Reviews
                    </SecondaryButton>
                  )}
                />
              </div>
            )}

            {previewSubmissions.length > 0 && (
              <div className="grid gap-4 p-5 sm:p-7">
                {previewSubmissions.map((submission) => (
                  <article
                    key={submission.id}
                    className="rounded-[1.25rem] border border-emerald-100 bg-white p-4 shadow-card sm:p-5"
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={submission.status} />
                          {submission.session_name && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                              {submission.session_name}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold leading-snug text-text-primary">{submission.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                          {submission.category || 'Uncategorised'}
                          {submission.keywords ? ` - Keywords: ${submission.keywords}` : ''}
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                          <p>
                            {submission.student_name || 'Unnamed student'}
                            {submission.student_email ? ` (${submission.student_email})` : ''}
                          </p>
                          <p className="text-xs font-medium uppercase tracking-wide text-text-muted sm:text-right">
                            Submitted {formatDate(submission.submitted_at || submission.created_at)}
                          </p>
                        </div>
                      </div>
                      <SecondaryButton
                        type="button"
                        className="w-full md:w-auto"
                        onClick={() => navigate(`/lecturer/pending-reviews/${submission.id}`)}
                      >
                        View Details
                      </SecondaryButton>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <InfoCallout
              title="Dashboard metrics unavailable"
              message="Risk summaries are shown inside review details after a lecturer check; queue-level scores and decision analytics still need a safe dashboard API."
              variant="warning"
            />
            <InfoCallout
              title="Workflow actions remain in review pages"
              message="Approvals, revision requests, rejections, similarity checks, and saved snapshots remain available only in the existing lecturer review workflow."
            />
          </section>
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default LecturerDashboardPage;
