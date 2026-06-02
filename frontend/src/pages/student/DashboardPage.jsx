import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSubmissions } from '../../api/submissions';
import { useAuth } from '../../auth/AuthContext';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const DECIDED_STATUSES = new Set(['approved', 'rejected', 'awaiting_revision']);
const DASHBOARD_PRIMARY_BUTTON_CLASS = '!bg-[#1B5E20] hover:!bg-[#174f1b] focus:ring-[#1B5E20]/20';

const STATUS_CARD_CLASSES = {
  approved: 'border-emerald-200 bg-[#f3fbf1]',
  awaiting_revision: 'border-brand-gold-light bg-[#fff9ea]',
  pending: 'border-border-subtle bg-white',
  pending_review: 'border-border-subtle bg-white',
  rejected: 'border-brand-gold-light bg-[#fff9ea]'
};

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

function getWelcomeHeading(name) {
  const trimmedName = String(name || '').trim();

  return trimmedName ? `Welcome back, ${trimmedName}.` : 'Welcome back.';
}

function DashboardMetadata({ helper, label, value }) {
  return (
    <div className="bg-white/90 px-4 py-3.5">
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <p className="mt-1 text-base font-bold leading-snug text-text-primary sm:text-lg">{value}</p>
      <p className="mt-1 text-[0.7rem] leading-4 text-text-muted">{helper}</p>
    </div>
  );
}

function StudentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const statusCardClass = STATUS_CARD_CLASSES[status] || 'border-border-subtle bg-white';

  return (
    <StudentDashboardLayout open>
      <header className="px-1 pt-1 sm:px-0">
        <h1 className="text-xs font-bold uppercase tracking-[0.18em] text-[#1B5E20]">
          Student Dashboard
        </h1>
        <h2 className="mt-1 font-serif text-2xl font-bold leading-tight text-[#1B5E20] sm:text-3xl">
          {getWelcomeHeading(user?.name)}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Here&apos;s the latest on your research topic submission.
        </p>
      </header>

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
          <section className="rounded-[1.5rem] border border-dashed border-border-strong bg-white p-5 shadow-card sm:p-8 lg:p-10">
            <EmptyStatePanel
              className="border-0 p-3 shadow-none sm:p-6"
              title="No topic submitted yet"
              message="Start by submitting a proposed research topic or checking an idea before submission."
              action={(
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <PrimaryButton
                    type="button"
                    className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                    onClick={() => navigate('/student/submit-topic')}
                  >
                    Submit Topic
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>
                    Check My Topic First
                  </SecondaryButton>
                </div>
              )}
            />
          </section>

          <InfoCallout
            title="Explore before you submit"
            message="Research browsing is available from Research Explorer. Similarity score, reviewer assignment, notifications, and detailed activity are not available on this dashboard yet."
            variant="warning"
          />
        </>
      )}

      {!isLoading && !error && currentSubmission && (
        <>
          <section className={`overflow-hidden rounded-[1.5rem] border shadow-[0_22px_60px_-44px_rgb(27_94_32_/_0.58)] ${statusCardClass}`}>
            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_8rem] md:items-start lg:p-7">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={currentSubmission.status} />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1B5E20]">Current Topic</p>
                </div>
                <h2 className="mt-3 max-w-4xl text-xl font-bold leading-snug text-text-primary sm:text-2xl lg:text-[1.65rem]">
                  {currentSubmission.title}
                </h2>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-text-secondary sm:text-sm">
                  {currentSubmission.category || 'Uncategorised'}
                  {currentSubmission.keywords ? ` - Keywords: ${currentSubmission.keywords}` : ''}
                </p>
              </div>

              <div className="w-fit min-w-36 justify-self-end rounded-[1rem] bg-white/90 px-4 py-3 text-center shadow-card md:min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Similarity Score
                </p>
                <p className="mt-1 text-lg font-black leading-tight text-text-primary">Not available yet</p>
              </div>
            </div>

            <div className="border-t border-black/5 bg-white/65 p-5 sm:p-6">
              <InfoCallout
                title={statusSummary.title}
                message={statusSummary.message}
                variant={statusSummary.calloutVariant}
                className="rounded-[0.9rem] border-l-4 bg-white/80"
              />

              <div className="mt-5 grid gap-px overflow-hidden rounded-[1rem] border border-border-subtle bg-border-subtle sm:grid-cols-2">
                <DashboardMetadata
                  label="Submitted"
                  value={formatDate(currentSubmission.submitted_at || currentSubmission.created_at)}
                  helper="From your latest submission record"
                />
                <DashboardMetadata
                  label="Decision Date"
                  value={showDecisionDate ? formatDate(currentSubmission.decided_at) : 'Not available yet'}
                  helper="Shown when a lecturer decision is recorded"
                />
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-[1fr_0.92fr]">
            <div className="rounded-[1.25rem] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
              <h3 className="font-semibold text-text-primary">Recent Activity</h3>
              <div className="mt-4 space-y-3.5">
                <div className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-gold" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Topic submission received</p>
                    <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                      Submitted {formatDate(currentSubmission.submitted_at || currentSubmission.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {showDecisionDate ? 'Decision recorded' : 'Lecturer decision pending'}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                      {showDecisionDate
                        ? `Recorded ${formatDate(currentSubmission.decided_at)}`
                        : 'Decision timing is not available until a lecturer records an outcome.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Dashboard data limits</p>
                    <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                      Reviewer identity, notification counts, progress timeline, and risk score are not available from the current student submissions API.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
              <h3 className="font-semibold text-text-primary">Quick Actions</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Open your submission history for the complete record and lecturer feedback.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <PrimaryButton
                  type="button"
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                  onClick={() => navigate('/student/my-submissions')}
                >
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
