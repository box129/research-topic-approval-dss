import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { createSubmission } from '../../api/submissions';

const MIN_TITLE_WORDS = 7;
const MAX_TITLE_WORDS = 24;

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function SubmitTopicPage() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSubmission, setCreatedSubmission] = useState(null);

  const wordCount = useMemo(() => countWords(title), [title]);
  const titleIsValid = wordCount >= MIN_TITLE_WORDS && wordCount <= MAX_TITLE_WORDS;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setCreatedSubmission(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!titleIsValid) {
      setError(`Title must be ${MIN_TITLE_WORDS} to ${MAX_TITLE_WORDS} words.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const submission = await createSubmission({
        title,
        category,
        keywords
      });
      setCreatedSubmission(submission);
      setTitle('');
      setCategory('');
      setKeywords('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to submit topic.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Submit Topic"
        subtitle="Submit a topic for lecturer review."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <label htmlFor="topic-title" className="block text-sm font-medium text-gray-900">
            Research topic title
          </label>
          <textarea
            id="topic-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            placeholder="Enter your proposed research topic"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>{wordCount} words</span>
            <span>{MIN_TITLE_WORDS}-{MAX_TITLE_WORDS} words required</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="topic-category" className="block text-sm font-medium text-gray-900">
                Category
              </label>
              <input
                id="topic-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Optional"
              />
            </div>

            <div>
              <label htmlFor="topic-keywords" className="block text-sm font-medium text-gray-900">
                Keywords
              </label>
              <input
                id="topic-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Optional, comma-separated"
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {createdSubmission && (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Topic submitted for review.
              {' '}
              <Link to="/student/my-submissions" className="font-semibold underline">
                View my submissions
              </Link>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>

        <aside className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">After submission</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-700">
            <li>Your topic will be saved with pending review status.</li>
            <li>You can track it from My Submissions.</li>
            <li>Your lecturer will review it through the approval workflow.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}

export default SubmitTopicPage;
