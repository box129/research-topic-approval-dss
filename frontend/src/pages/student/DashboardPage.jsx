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
          <EmptyStatePanel
            title="No topic submitted yet"
            message="Start by submitting a proposed research topic or checking a topic idea before submission."
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

          <InfoCallout
            title="Before you submit"
            message="Similarity score, reviewer assignment, notifications, and detailed activity are not available on this dashboard yet."
          />
        </>
      )}

      {!isLoading && !error && currentSubmission && (
        <>
          <section className="rounded-card border border-border-subtle bg-white p-6 shadow-card">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Current Topic</p>
                <h2 className="mt-2 text-xl font-semibold text-text-primary">{currentSubmission.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {currentSubmission.category || 'Uncategorised'}
                  {currentSubmission.keywords ? ` - Keywords: ${currentSubmission.keywords}` : ''}
                </p>
              </div>
              <StatusBadge status={currentSubmission.status} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
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
              <DashboardStatusCard
                label="Similarity Score"
                value="Not available yet"
                helper="Detailed similarity data is not exposed on this dashboard yet"
              />
            </div>
          </section>

          <InfoCallout
            title={statusSummary.title}
            message={statusSummary.message}
            variant={statusSummary.calloutVariant}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-border-subtle bg-white p-5 shadow-card">
              <h3 className="font-semibold text-text-primary">Quick Actions</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Open your submission history for the complete record and lecturer feedback.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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

            <InfoCallout
              title="Dashboard data limits"
              message="Reviewer identity, notification counts, progress timeline, and risk score are not available from the current student submissions API."
            />
          </section>
        </>
      )}
    </StudentDashboardLayout>
  );
}

export default StudentDashboardPage;
