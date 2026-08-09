import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLecturerPendingSubmissions } from '../../api/submissions';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
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

  const preview = useMemo(() => submissions.slice(0, 3), [submissions]);

  return (
    <LecturerDashboardLayout>
      <PageHeader
        title="Lecturer Dashboard"
        subtitle="Triage pending topic reviews using the lecturer review workflow."
        action={(
          <SecondaryButton type="button" onClick={() => navigate('/lecturer/check-similarity')}>
            Check Similarity
          </SecondaryButton>
        )}
      />

      {isLoading && <LoadingState label="Loading lecturer dashboard" />}
      {!isLoading && error && (
        <ErrorState title="Could not load lecturer dashboard" message={error} onRetry={loadDashboard} />
      )}

      {!isLoading && !error && (
        <>
          <p
            aria-label={`Pending reviews ${submissions.length}`}
            className="w-fit rounded-full border border-feedback-warning-border bg-feedback-warning-bg px-3 py-1 text-sm font-semibold text-feedback-warning"
          >
            Pending reviews <span className="ml-1 text-text-primary">{submissions.length}</span>
          </p>
          <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-card">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-bold">Pending review queue preview</h2>
              <PrimaryButton type="button" onClick={() => navigate('/lecturer/pending-reviews')}>
                View All Pending Reviews
              </PrimaryButton>
            </div>

            {preview.length === 0 ? (
              <div className="p-5">
                <EmptyStatePanel
                  title="No pending reviews"
                  message="Student submissions awaiting lecturer review will appear here."
                  action={(
                    <SecondaryButton type="button" onClick={() => navigate('/lecturer/pending-reviews')}>
                      Open Pending Reviews
                    </SecondaryButton>
                  )}
                />
              </div>
            ) : (
              <div>
                {preview.map((submission) => (
                  <article
                    key={submission.id}
                    className="grid gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="min-w-0">
                      <StatusBadge status={submission.status} />
                      <h3 className="mt-2 break-words text-base font-semibold leading-6">{submission.title}</h3>
                      <p className="mt-1 break-words text-sm text-text-secondary">
                        {submission.student_name || 'Unnamed student'} - {submission.category || 'Uncategorised'} - Submitted {formatDate(submission.submitted_at || submission.created_at)}
                      </p>
                      {submission.student_email && (
                        <p className="mt-1 break-all text-sm text-text-secondary">{submission.student_email}</p>
                      )}
                      {submission.keywords && (
                        <p className="mt-1 break-words text-sm text-text-secondary">Keywords: {submission.keywords}</p>
                      )}
                      {submission.session_name && (
                        <p className="mt-1 text-sm text-text-muted">{submission.session_name}</p>
                      )}
                    </div>
                    <SecondaryButton
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => navigate(`/lecturer/pending-reviews/${submission.id}`)}
                    >
                      View Details
                    </SecondaryButton>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default LecturerDashboardPage;
