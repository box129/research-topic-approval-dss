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
const submitSteps = [
  { label: 'Enter topic', state: 'active' },
  { label: 'Pre-check', state: 'coming later' },
  { label: 'Confirm', state: 'coming later' }
];

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

      <div className="space-y-6">
        <div className="rounded-[1.25rem] border border-emerald-100 bg-white/80 p-4 shadow-card sm:p-5">
          <ol className="flex flex-col gap-3 text-xs font-bold uppercase tracking-[0.16em] text-text-muted sm:flex-row sm:items-center">
            {submitSteps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-3">
                <span className={[
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem]',
                  step.state === 'active'
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-border-strong bg-white text-text-muted'
                ].join(' ')}>
                  {index + 1}
                </span>
                <span className={step.state === 'active' ? 'text-brand-green' : ''}>
                  {step.label}
                </span>
                {step.state !== 'active' && (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.6rem] normal-case tracking-normal text-text-muted">
                    {step.state}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-45px_rgb(6_95_70_/_0.45)]">
          <div className="border-b border-border-subtle bg-gradient-to-br from-white via-white to-[#f4faef] p-5 sm:p-8">
            <InfoCallout
              title="Before you submit"
              message="Use a clear, specific title. Category and keywords are optional, but they can help reviewers understand the research area."
              className="bg-white"
            />
          </div>

          <div className="space-y-8 p-5 sm:p-8">
            <div>
              <TextAreaInput
                id="topic-title"
                label="Research topic title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                rows={6}
                placeholder="Enter your proposed research topic"
                helperText="Write the complete topic title you want reviewed."
                className="min-h-40 bg-[#f8faf8] text-base sm:min-h-44"
              />
              <div className="mt-3 border-t border-border-subtle pt-3">
                <div className="flex flex-col gap-2 text-xs font-medium uppercase tracking-wide text-text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>{wordCount} words</span>
                  <span>{MIN_TITLE_WORDS}-{MAX_TITLE_WORDS} words required</span>
                </div>
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

        <aside className="rounded-[1.5rem] border border-emerald-100 bg-white p-6 shadow-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-brand-green">After submission</h2>
              <p className="mt-2 text-sm text-text-secondary">
                This page only creates a pending topic submission after you press Submit for Review.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-green">
              Lecturer review workflow
            </span>
          </div>
          <ul className="mt-5 grid gap-4 text-sm text-text-secondary md:grid-cols-3">
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
