import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextAreaInput from '../../components/ui/TextAreaInput';
import TextInput from '../../components/ui/TextInput';
import { createSubmission } from '../../api/submissions';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

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
    <StudentDashboardLayout>
      <PageHeader
        eyebrow="Student portal"
        title="Submit Topic"
        subtitle="Share your proposed research topic for lecturer review."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-8">
          <div className="space-y-7">
            <InfoCallout
              title="Before you submit"
              message="Use a clear, specific title. Category and keywords are optional, but they can help reviewers understand the research area."
            />

            <div className="rounded-[1rem] border border-border-subtle bg-surface-muted/40 p-4 sm:p-5">
              <TextAreaInput
                id="topic-title"
                label="Research topic title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                rows={5}
                placeholder="Enter your proposed research topic"
                helperText="Write the complete topic title you want reviewed."
                className="min-h-36 bg-white text-base"
              />
              <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3 text-xs font-medium uppercase tracking-wide text-text-muted sm:flex-row sm:items-center sm:justify-between">
                <span>{wordCount} words</span>
                <span>{MIN_TITLE_WORDS}-{MAX_TITLE_WORDS} words required</span>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                id="topic-category"
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={isSubmitting}
                placeholder="Optional"
              />

              <TextInput
                id="topic-keywords"
                label="Keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                disabled={isSubmitting}
                placeholder="Optional, comma-separated"
              />
            </div>

            {error && (
              <InfoCallout variant="danger" message={error} />
            )}

            {createdSubmission && (
              <InfoCallout variant="success" title="Topic submitted for review.">
                <Link to="/student/my-submissions" className="font-semibold underline">
                  View my submissions
                </Link>
              </InfoCallout>
            )}

            <div className="flex justify-end border-t border-border-subtle pt-5">
              <PrimaryButton
                type="submit"
                disabled={isSubmitting}
                isLoading={isSubmitting}
              >
                Submit for Review
              </PrimaryButton>
            </div>
          </div>
        </form>

        <aside className="rounded-[1.5rem] border border-emerald-100 bg-white p-6 shadow-card lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-brand-green">After submission</h2>
          <ul className="mt-5 space-y-4 text-sm text-text-secondary">
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] p-4">
              Your topic will be saved with pending review status.
            </li>
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] p-4">
              You can track it from My Submissions.
            </li>
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] p-4">
              Your lecturer will review it through the approval workflow.
            </li>
          </ul>
        </aside>
      </div>
    </StudentDashboardLayout>
  );
}

export default SubmitTopicPage;
