import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import { listSubmissions } from '../../api/submissions';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

function formatDate(value) {
  if (!value) {
    return 'Not submitted';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

const DECIDED_STATUSES = new Set(['approved', 'rejected', 'awaiting_revision']);

function normalizeStatus(status) {
  return String(status || 'pending_review').toLowerCase();
}

function shouldShowFeedback(submission) {
  return DECIDED_STATUSES.has(normalizeStatus(submission.status));
}

function getFeedbackText(submission) {
  return submission.decision_reason || 'No additional comment was provided.';
}

function getStatusSummary(submission) {
  const status = normalizeStatus(submission.status);

  if (status === 'pending_review') {
    return {
      title: 'Pending review',
      message: 'Your submission is waiting for a lecturer decision.',
      variant: 'info'
    };
  }

  if (status === 'awaiting_revision') {
    return {
      title: 'Awaiting revision',
      message: 'Review the feedback below before preparing your next submission.',
      variant: 'warning'
    };
  }

  if (status === 'approved') {
    return {
      title: 'Approved',
      message: 'This submission has been approved.',
      variant: 'success'
    };
  }

  if (status === 'rejected') {
    return {
      title: 'Not approved',
      message: 'Review the feedback below before deciding on your next step.',
      variant: 'danger'
    };
  }

  return {
    title: 'Submission status available',
    message: 'This submission has a recorded status in your history.',
    variant: 'info'
  };
}

function getCounts(submissions) {
  return submissions.reduce((counts, submission) => {
    const status = normalizeStatus(submission.status);

    return {
      total: counts.total + 1,
      pending: counts.pending + (status === 'pending_review' ? 1 : 0),
      awaitingRevision: counts.awaitingRevision + (status === 'awaiting_revision' ? 1 : 0),
      approved: counts.approved + (status === 'approved' ? 1 : 0)
    };
  }, {
    total: 0,
    pending: 0,
    awaitingRevision: 0,
    approved: 0
  });
}

function MySubmissionsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const counts = useMemo(() => getCounts(submissions), [submissions]);
  const summaryCards = useMemo(() => [
    {
      label: 'Total',
      value: counts.total,
      helper: 'All submitted topics',
      tone: 'border-brand-green/25 bg-white'
    },
    {
      label: 'Pending',
      value: counts.pending,
      helper: 'Awaiting review',
      tone: 'border-sky-200 bg-sky-50/80'
    },
    {
      label: 'Awaiting revision',
      value: counts.awaitingRevision,
      helper: 'Needs follow-up',
      tone: 'border-amber-200 bg-amber-50/80'
    },
    {
      label: 'Approved',
      value: counts.approved,
      helper: 'Ready to continue',
      tone: 'border-emerald-200 bg-emerald-50/80'
    }
  ], [counts]);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSubmissions(await listSubmissions());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load submissions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  return (
    <StudentDashboardLayout>
      <PageHeader
        action={(
          <SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
            Submit Topic
          </SecondaryButton>
        )}
        eyebrow="Student portal"
        title="My Submissions"
        subtitle="Track your submitted topics, review status, and student-safe feedback."
      />

      {isLoading && <LoadingState label="Loading submissions" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load submissions"
          message={error}
          onRetry={loadSubmissions}
        />
      )}

      {!isLoading && !error && submissions.length === 0 && (
        <EmptyStatePanel
          title="No submissions yet"
          message="Submit your first research topic when you are ready for lecturer review."
          action={(
            <PrimaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
              Submit Topic
            </PrimaryButton>
          )}
        />
      )}

      {!isLoading && !error && submissions.length > 0 && (
        <>
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white/85 p-4 shadow-card sm:p-5">
            <div className="flex flex-col gap-2 border-b border-emerald-50 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                  Submission overview
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-text-primary">Review history at a glance</h2>
              </div>
              <p className="max-w-xl text-sm text-text-secondary">
                Counts reflect only your submitted topics and student-visible review state.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-[1.25rem] border px-4 py-3 ${card.tone}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">{card.label}</p>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-lg font-semibold text-brand-green shadow-sm">
                      {card.value}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-text-muted">{card.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-[1.75rem] border border-emerald-100 bg-[#fbfdf8] p-4 shadow-card sm:p-5" aria-label="Submission history">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                  Timeline
                </p>
                <h2 className="text-xl font-semibold text-text-primary">Submission history</h2>
              </div>
              <p className="text-sm text-text-secondary">
                Feedback is shown only when a decision is visible to you.
              </p>
            </div>

            <div className="space-y-4">
            {submissions.map((submission) => {
              const statusSummary = getStatusSummary(submission);

              return (
                <article key={submission.id} className="overflow-hidden rounded-[1.4rem] border border-emerald-100 bg-white shadow-card">
                  <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.34fr)]">
                    <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-4xl">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                          Student record
                        </p>
                        <h2 className="mt-2 text-xl font-semibold leading-snug text-text-primary">{submission.title}</h2>
                      </div>
                      <StatusBadge status={submission.status} />
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-[1rem] border border-emerald-50 bg-[#f6fbf1] p-3">
                        <dt className="font-medium text-text-muted">Category</dt>
                        <dd className="mt-1 text-text-primary">{submission.category || 'Uncategorised'}</dd>
                      </div>
                      <div className="rounded-[1rem] border border-emerald-50 bg-[#f6fbf1] p-3">
                        <dt className="font-medium text-text-muted">Submitted</dt>
                        <dd className="mt-1 text-text-primary">
                          {formatDate(submission.submitted_at || submission.created_at)}
                        </dd>
                      </div>
                      <div className="rounded-[1rem] border border-emerald-50 bg-[#f6fbf1] p-3">
                        <dt className="font-medium text-text-muted">Session</dt>
                        <dd className="mt-1 text-text-primary">{submission.session_name || 'Not available'}</dd>
                      </div>
                      <div className="rounded-[1rem] border border-emerald-50 bg-[#f6fbf1] p-3">
                        <dt className="font-medium text-text-muted">Keywords</dt>
                        <dd className="mt-1 text-text-primary">{submission.keywords || 'Not provided'}</dd>
                      </div>
                    </dl>
                    </div>

                    <div className="space-y-3 rounded-[1.2rem] border border-emerald-50 bg-[#fbfdf8] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Review state
                      </p>
                      <InfoCallout
                        variant={statusSummary.variant}
                        title={statusSummary.title}
                        message={statusSummary.message}
                      />

                      {shouldShowFeedback(submission) && (
                        <InfoCallout
                          variant={statusSummary.variant}
                          title="Decision feedback"
                          message={getFeedbackText(submission)}
                        >
                          {submission.decided_at && (
                            <p className="text-xs">
                              Decision recorded {formatDate(submission.decided_at)}
                            </p>
                          )}
                        </InfoCallout>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          </section>
        </>
      )}
    </StudentDashboardLayout>
  );
}

export default MySubmissionsPage;
