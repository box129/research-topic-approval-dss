import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { listSubmissions } from '../../api/submissions';

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

function shouldShowFeedback(submission) {
  return DECIDED_STATUSES.has(String(submission.status || '').toLowerCase());
}

function getFeedbackText(submission) {
  return submission.decision_reason || 'No additional comment was provided.';
}

function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
    <>
      <PageHeader
        title="My Submissions"
        subtitle="Track topics you have submitted for review."
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
        <EmptyState
          title="No submissions yet"
          message="Submit your first research topic when you are ready for lecturer review."
          action={(
            <Link to="/student/submit-topic" className="inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Submit Topic
            </Link>
          )}
        />
      )}

      {!isLoading && !error && submissions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Topic
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium text-gray-950">{submission.title}</p>
                    {submission.keywords && (
                      <p className="mt-1 text-sm text-gray-500">Keywords: {submission.keywords}</p>
                    )}
                    {shouldShowFeedback(submission) && (
                      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="font-semibold text-gray-900">Lecturer feedback</p>
                        <p className="mt-1">{getFeedbackText(submission)}</p>
                        {submission.decided_at && (
                          <p className="mt-2 text-xs text-gray-500">
                            Decision recorded {formatDate(submission.decided_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusBadge status={submission.status} />
                    {String(submission.status || '').toLowerCase() === 'pending_review' && (
                      <p className="mt-2 text-xs text-gray-500">Awaiting lecturer review.</p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-gray-600">
                    {submission.category || 'Uncategorised'}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-gray-600">
                    {formatDate(submission.submitted_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default MySubmissionsPage;
