import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLecturerPendingSubmissions } from '../../api/submissions';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
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
          <section className="grid gap-4 rounded-[1.25rem] border border-emerald-100 bg-white/80 p-4 shadow-card md:grid-cols-2 xl:grid-cols-4">
            <DashboardStatusCard
              label="Pending Reviews"
              value={submissions.length}
              helper="Loaded from the existing pending review queue"
            />
            <DashboardStatusCard
              label="High-risk Alerts"
              value="Not available yet"
              helper="Risk summaries are not connected to the dashboard"
              tone="warning"
            />
            <DashboardStatusCard
              label="Decision Metrics"
              value="Not available yet"
              helper="Approved, rejected, and revision counts need a dashboard endpoint"
            />
            <DashboardStatusCard
              label="Recent Activity"
              value="Not connected yet"
              helper="Activity feed data is not available from the current API"
            />
          </section>

          <InfoCallout
            title="Dashboard data limits"
            message="This dashboard uses only the existing pending review queue. Similarity risk, activity, workload, and trend analytics are shown as unavailable until a safe dashboard API exists."
          />

          <section className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-[0_18px_55px_-35px_rgb(4_120_87_/_0.45)]">
            <div className="border-b border-border-subtle bg-[#fbfff7] p-5 sm:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
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
                    className="rounded-[1rem] border border-border-subtle bg-white p-5 shadow-card"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
                        <p className="mt-2 text-sm text-text-secondary">
                          {submission.student_name || 'Unnamed student'}
                          {submission.student_email ? ` (${submission.student_email})` : ''}
                        </p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                          Submitted {formatDate(submission.submitted_at || submission.created_at)}
                        </p>
                      </div>
                      <SecondaryButton
                        type="button"
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
              title="High-risk triage not connected yet"
              message="The current dashboard does not receive risk scores or similarity summaries. Run checks from the existing review detail flow when reviewing a specific submission."
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
