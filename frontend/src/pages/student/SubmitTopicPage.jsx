import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextAreaInput from '../../components/ui/TextAreaInput';
import TextInput from '../../components/ui/TextInput';
import { createSubmission } from '../../api/submissions';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const MIN_TITLE_WORDS = 7;
const MAX_TITLE_WORDS = 24;
const SUBMIT_PRIMARY_BUTTON_CLASS = '!bg-[#1B5E20] hover:!bg-[#174f1b] focus:ring-[#1B5E20]/20';
const submitSteps = [
  { label: 'Enter topic', state: 'active', helper: 'Current step' },
  { label: 'Pre-check', state: 'coming later', helper: 'Coming later' },
  { label: 'Confirm', state: 'coming later', helper: 'Coming later' }
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
    <StudentDashboardLayout open>
      <header className="px-1 pt-1 sm:px-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1B5E20]">
          Student Portal
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold leading-tight text-[#1B5E20] sm:text-4xl">
          Submit Your Research Topic
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Share a clear proposed topic for lecturer review.
        </p>
      </header>

      <div className="space-y-5 sm:space-y-6">
        <div className="rounded-[1.25rem] border border-emerald-100 bg-white/85 px-4 py-4 shadow-card sm:px-6">
          <ol className="grid grid-cols-3 gap-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted sm:text-xs sm:tracking-[0.16em]">
            {submitSteps.map((step, index) => (
              <li key={step.label} className="relative flex min-w-0 items-start gap-2 sm:gap-3">
                <span className={[
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem]',
                  step.state === 'active'
                    ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                    : 'border-border-strong bg-white text-text-muted'
                ].join(' ')}>
                  {index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className={step.state === 'active' ? 'block text-[#1B5E20]' : 'block'}>
                    {step.label}
                  </span>
                  <span className={[
                    'mt-1 block text-[0.58rem] normal-case tracking-normal',
                    step.state === 'active' ? 'text-[#1B5E20]' : 'text-text-muted'
                  ].join(' ')}>
                    {step.helper}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-45px_rgb(27_94_32_/_0.4)]">
          <div className="border-b border-border-subtle bg-[#f8fbf7] px-5 py-5 sm:px-8 sm:py-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1B5E20]">
              Enter Topic
            </p>
            <h2 className="mt-2 text-xl font-bold text-text-primary sm:text-2xl">
              Proposed Research Topic
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Enter the title you want reviewed. Category and keywords are optional context for your lecturer.
            </p>
          </div>

          <div className="space-y-7 p-5 sm:p-8">
            <div>
              <TextAreaInput
                id="topic-title"
                label="Research Topic Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                rows={6}
                placeholder="Enter your research title here..."
                helperText="Write a clear and specific title for lecturer review."
                className="min-h-36 bg-[#f8faf8] p-4 text-base sm:min-h-40"
              />
              <div className="mt-3 border-t border-border-subtle pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                  <span>{wordCount} words</span>
                  <span className={title && !titleIsValid ? 'text-feedback-danger' : ''}>
                    {MIN_TITLE_WORDS}-{MAX_TITLE_WORDS} words required
                  </span>
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

            <InfoCallout
              title="Before you submit"
              message="Submitting creates a pending topic for lecturer review. This page submits directly and does not generate a score."
              className="bg-[#f1fbf4]"
            />

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
                className={`w-full sm:w-auto ${SUBMIT_PRIMARY_BUTTON_CLASS}`}
              >
                Submit for Review
              </PrimaryButton>
            </div>
          </div>
        </form>

        <aside className="rounded-[1.5rem] border border-emerald-100 bg-white/90 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#1B5E20]">After submission</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                This page only creates a pending topic submission after you press Submit for Review.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#1B5E20]">
              Lecturer review workflow
            </span>
          </div>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-text-secondary md:grid-cols-3">
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] px-4 py-3">
              Your topic will be saved with pending review status.
            </li>
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] px-4 py-3">
              You can track it from My Submissions.
            </li>
            <li className="rounded-card border border-border-subtle bg-[#f7fbf4] px-4 py-3">
              Your lecturer will review it through the approval workflow.
            </li>
          </ul>
        </aside>
      </div>
    </StudentDashboardLayout>
  );
}

export default SubmitTopicPage;
