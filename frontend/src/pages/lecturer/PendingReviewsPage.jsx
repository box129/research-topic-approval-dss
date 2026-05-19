import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { listLecturerPendingSubmissions } from '../../api/submissions';

function formatDate(value) {
  if (!value) {
    return 'Not submitted';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function PendingReviewsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <>
      <PageHeader
        title="Pending Reviews"
        subtitle="Review submitted student topics waiting for lecturer action."
      />

      {isLoading && <LoadingState label="Loading pending reviews" />}

      {!isLoading && error && (
        <ErrorState
          title="Could not load pending reviews"
          message={error}
          onRetry={loadSubmissions}
        />
      )}

      {!isLoading && !error && submissions.length === 0 && (
        <EmptyState
          title="No pending reviews"
          message="Student submissions with pending review status will appear here."
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
                  Student
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
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-sm font-medium text-gray-900">
                      {submission.student_name || 'Unnamed student'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {submission.student_email || 'No email available'}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusBadge status={submission.status} />
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

export default PendingReviewsPage;
