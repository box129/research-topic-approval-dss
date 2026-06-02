import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../../components/ui/ErrorState';
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
const MY_SUBMISSIONS_PRIMARY_BUTTON_CLASS =
  '!bg-[#1B5E20] shadow-sm hover:!bg-[#174F1C] focus-visible:!ring-[#1B5E20]';

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

function getReviewTone(status) {
  switch (normalizeStatus(status)) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50/80 text-emerald-950';
    case 'awaiting_revision':
      return 'border-amber-200 bg-amber-50/80 text-amber-950';
    case 'rejected':
      return 'border-red-200 bg-red-50/80 text-red-950';
    case 'pending_review':
      return 'border-sky-200 bg-sky-50/80 text-sky-950';
    default:
      return 'border-slate-200 bg-slate-50/90 text-slate-900';
  }
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
      tone: 'border-brand-green/25 bg-white'
    },
    {
      label: 'Approved',
      value: counts.approved,
      tone: 'border-emerald-200 bg-emerald-50/80'
    },
    {
      label: 'Awaiting revision',
      value: counts.awaitingRevision,
      tone: 'border-amber-200 bg-amber-50/80'
    },
    {
      label: 'Pending',
      value: counts.pending,
      tone: 'border-sky-200 bg-sky-50/80'
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
    <StudentDashboardLayout open>
      <header className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between sm:px-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Student portal</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#1B5E20] sm:text-4xl">
            My Submissions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Your full submission history, outcomes, and lecturer feedback.
          </p>
        </div>
        <SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
          Submit Topic
        </SecondaryButton>
      </header>

      {isLoading && <LoadingState label="Loading submissions" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load submissions"
          message={error}
          onRetry={loadSubmissions}
        />
      )}

      {!isLoading && !error && submissions.length === 0 && (
        <section className="rounded-2xl border border-dashed border-emerald-200 bg-white/90 px-5 py-12 text-center shadow-sm sm:px-8 sm:py-16">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl font-light text-[#1B5E20]">
            +
          </div>
          <h2 className="mt-5 font-serif text-2xl font-semibold text-[#1B5E20]">No submissions yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
            Submit your first research topic when you are ready for lecturer review.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton
              type="button"
              className={MY_SUBMISSIONS_PRIMARY_BUTTON_CLASS}
              onClick={() => navigate('/student/submit-topic')}
            >
              Submit a Topic
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>
              Check My Topic First
            </SecondaryButton>
          </div>
        </section>
      )}

      {!isLoading && !error && submissions.length > 0 && (
        <>
          <section aria-labelledby="submission-overview-title" className="flex flex-wrap items-center gap-2">
            <h2 id="submission-overview-title" className="sr-only">
              Submission overview
            </h2>
            {summaryCards.map((card) => (
              <div key={card.label} className={`rounded-full border px-3 py-2 text-xs shadow-sm ${card.tone}`}>
                <span className="font-bold uppercase tracking-[0.1em]">{card.label}</span>
                <span className="ml-2 text-sm font-semibold">{card.value}</span>
              </div>
            ))}
          </section>

          <section aria-label="Submission history">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Submission history</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-text-primary">Your topic records</h2>
              </div>
              <p className="text-xs leading-5 text-text-secondary">
                Lecturer identity stays protected. Feedback appears only after a recorded decision.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {submissions.map((submission) => {
                const statusSummary = getStatusSummary(submission);
                const reviewTone = getReviewTone(submission.status);

                return (
                  <article
                    key={submission.id}
                    className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 shadow-sm"
                  >
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
                      <div className="p-4 sm:p-5">
                        <StatusBadge status={submission.status} />
                        <h3 className="mt-3 text-base font-semibold leading-6 text-text-primary">{submission.title}</h3>

                        <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-primary/75">Category</dt>
                            <dd className="mt-1 leading-5 text-text-secondary">
                              {submission.category || 'Uncategorised'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-primary/75">Submitted</dt>
                            <dd className="mt-1 leading-5 text-text-secondary">
                              {formatDate(submission.submitted_at || submission.created_at)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-primary/75">Session</dt>
                            <dd className="mt-1 leading-5 text-text-secondary">
                              {submission.session_name || 'Not available'}
                            </dd>
                          </div>
                          <div className="sm:col-span-3">
                            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-primary/75">Keywords</dt>
                            <dd className="mt-1 leading-5 text-text-secondary">
                              {submission.keywords || 'Not provided'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <aside className={`border-t px-4 py-4 lg:border-l lg:border-t-0 ${reviewTone}`}>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Review state</p>
                        <h4 className="mt-2 text-sm font-semibold">{statusSummary.title}</h4>
                        <p className="mt-1 text-sm leading-5 opacity-80">{statusSummary.message}</p>

                        {shouldShowFeedback(submission) && (
                          <div className="mt-4 border-t border-black/10 pt-3">
                            <p className="text-xs font-bold uppercase tracking-[0.1em] opacity-70">Decision feedback</p>
                            <p className="mt-2 text-sm leading-5 opacity-85">{getFeedbackText(submission)}</p>
                            {submission.decided_at && (
                              <p className="mt-2 text-xs font-semibold opacity-75">
                                Decision recorded {formatDate(submission.decided_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </aside>
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
