import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSubmissions } from '../../api/submissions';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const DECIDED_STATUSES = new Set(['approved', 'rejected', 'awaiting_revision']);

function getSubmissionTimestamp(submission) {
  const rawDate = submission?.submitted_at || submission?.created_at;
  const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMostRecentSubmission(submissions) {
  return submissions.reduce((latest, submission) => {
    if (!latest) {
      return submission;
    }

    return getSubmissionTimestamp(submission) > getSubmissionTimestamp(latest) ? submission : latest;
  }, null);
}

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

function normalizeStatus(status) {
  return String(status || 'not_submitted').toLowerCase();
}

function getStatusMessage(submission) {
  const status = normalizeStatus(submission?.status);

  if (status === 'pending_review' || status === 'pending') {
    return {
      calloutVariant: 'info',
      title: 'Lecturer review is pending',
      message: 'Your topic has been submitted and is waiting for lecturer review. No action is required right now.'
    };
  }

  if (status === 'awaiting_revision') {
    return {
      calloutVariant: 'warning',
      title: 'Revision requested',
      message: submission?.decision_reason || 'A lecturer has requested changes. Review the feedback before submitting an updated topic.'
    };
  }

  if (status === 'approved') {
    return {
      calloutVariant: 'success',
      title: 'Topic approved',
      message: 'Your topic has been approved. You can continue with the next academic steps for your proposal.'
    };
  }

  if (status === 'rejected') {
    return {
      calloutVariant: 'danger',
      title: 'Topic rejected',
      message: submission?.decision_reason || 'This topic was not approved. Review your submission details before choosing your next step.'
    };
  }

  return {
    calloutVariant: 'info',
    title: 'Submission status available',
    message: submission?.decision_reason || 'Your latest submission status is shown below. Open My Submissions for the complete record.'
  };
}

function getPrimaryActionLabel(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'awaiting_revision') {
    return 'Review Feedback';
  }

  return 'View My Submissions';
}

function StudentDashboardPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setSubmissions(await listSubmissions());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load student dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const currentSubmission = useMemo(() => getMostRecentSubmission(submissions), [submissions]);
  const statusSummary = getStatusMessage(currentSubmission);
  const status = normalizeStatus(currentSubmission?.status);
  const showDecisionDate = DECIDED_STATUSES.has(status);

  return (
    <StudentDashboardLayout>
      <PageHeader
        eyebrow="Student Portal"
        title="Student Dashboard"
        subtitle="Track your current research topic status and next steps."
      />

      {isLoading && <LoadingState label="Loading student dashboard" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load student dashboard"
          message={error}
          onRetry={loadSubmissions}
        />
      )}

      {!isLoading && !error && !currentSubmission && (
        <>
          <section className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-45px_rgb(6_95_70_/_0.6)]">
            <div className="border-b border-emerald-100 bg-gradient-to-br from-[#fffaf0] via-white to-[#f3faee] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green">Welcome back</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-text-primary sm:text-3xl">
                Ready to start your research approval journey?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Start by submitting a proposed research topic or checking a topic idea before submission.
              </p>
            </div>
            <div className="p-5 sm:p-8">
              <EmptyStatePanel
                title="No topic submitted yet"
                message="Use the quick actions below to start your student research approval workflow."
                action={(
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <PrimaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
                      Submit Topic
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>
                      Check My Topic
                    </SecondaryButton>
                  </div>
                )}
              />
            </div>
          </section>

          <InfoCallout
            title="Before you submit"
            message="Similarity score, reviewer assignment, notifications, and detailed activity are not available on this dashboard yet."
          />
        </>
      )}

      {!isLoading && !error && currentSubmission && (
        <>
          <section className="overflow-hidden rounded-[1.75rem] border border-brand-gold-light bg-[#fff8e5] shadow-[0_22px_70px_-42px_rgb(180_83_9_/_0.5)]">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={currentSubmission.status} />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold-dark">Current Topic</p>
                </div>
                <h2 className="mt-4 max-w-4xl text-2xl font-bold leading-tight text-text-primary sm:text-3xl lg:text-4xl">
                  {currentSubmission.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                  {currentSubmission.category || 'Uncategorised'}
                  {currentSubmission.keywords ? ` - Keywords: ${currentSubmission.keywords}` : ''}
                </p>
              </div>

              <div className="rounded-[1.25rem] bg-white p-4 text-center shadow-card">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Similarity Score
                </p>
                <p className="mt-2 text-2xl font-black leading-tight text-text-primary">Not available yet</p>
              </div>
            </div>

            <div className="border-t border-brand-gold-light/80 bg-white/70 p-5 sm:p-6 lg:p-8">
              <InfoCallout
                title={statusSummary.title}
                message={statusSummary.message}
                variant={statusSummary.calloutVariant}
                className="bg-white"
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DashboardStatusCard
                  label="Submitted"
                  value={formatDate(currentSubmission.submitted_at || currentSubmission.created_at)}
                  helper="From your latest submission record"
                />
                <DashboardStatusCard
                  label="Decision Date"
                  value={showDecisionDate ? formatDate(currentSubmission.decided_at) : 'Not available yet'}
                  helper="Shown when a lecturer decision is recorded"
                />
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[1.5rem] border border-border-subtle bg-white p-6 shadow-card">
              <h3 className="font-semibold text-text-primary">Recent Activity</h3>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-gold" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Topic submission received</p>
                    <p className="text-xs text-text-secondary">
                      Submitted {formatDate(currentSubmission.submitted_at || currentSubmission.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {showDecisionDate ? 'Decision recorded' : 'Lecturer decision pending'}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {showDecisionDate
                        ? `Recorded ${formatDate(currentSubmission.decided_at)}`
                        : 'Decision timing is not available until a lecturer records an outcome.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Dashboard data limits</p>
                    <p className="text-xs text-text-secondary">
                      Reviewer identity, notification counts, progress timeline, and risk score are not available from the current student submissions API.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border-subtle bg-white p-6 shadow-card">
              <h3 className="font-semibold text-text-primary">Quick Actions</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Open your submission history for the complete record and lecturer feedback.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <PrimaryButton type="button" onClick={() => navigate('/student/my-submissions')}>
                  {getPrimaryActionLabel(currentSubmission.status)}
                </PrimaryButton>
                {status === 'awaiting_revision' && (
                  <SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
                    Submit Topic
                  </SecondaryButton>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </StudentDashboardLayout>
  );
}

export default StudentDashboardPage;
