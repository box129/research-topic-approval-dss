import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  listLecturerPendingSubmissions,
  updateLecturerSubmissionStatus
} from '../../api/submissions';

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
  const [successMessage, setSuccessMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

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

  const handleStatusUpdate = async (submission, status, confirmLabel, successLabel) => {
    const confirmed = window.confirm(`${confirmLabel} this submission?`);
    if (!confirmed) {
      return;
    }

    setUpdatingId(submission.id);
    setError('');
    setSuccessMessage('');

    try {
      await updateLecturerSubmissionStatus(submission.id, status);
      setSuccessMessage(`Submission ${successLabel} successfully.`);
      await loadSubmissions();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update submission status.');
    } finally {
      setUpdatingId(null);
    }
  };

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

      {!isLoading && successMessage && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

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
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
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
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingId === submission.id}
                        onClick={() => handleStatusUpdate(submission, 'approved', 'Approve', 'approved')}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === submission.id}
                        onClick={() => handleStatusUpdate(submission, 'awaiting_revision', 'Request revision for', 'marked as awaiting revision')}
                        className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Request Revision
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === submission.id}
                        onClick={() => handleStatusUpdate(submission, 'rejected', 'Reject', 'rejected')}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
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
