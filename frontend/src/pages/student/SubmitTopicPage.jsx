import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createSubmission } from '../../api/submissions';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';

const MIN_WORDS = 7;
const MAX_WORDS = 24;
const countWords = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;

function SubmitTopicPage() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [titleError, setTitleError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef(null);
  const reviewRef = useRef(null);
  const submissionPendingRef = useRef(false);
  const titleInputRef = useRef(null);
  const wordCount = useMemo(() => countWords(title), [title]);

  useEffect(() => {
    if (requestError) errorRef.current?.focus();
  }, [requestError]);

  useEffect(() => {
    if (isReviewing) reviewRef.current?.focus();
  }, [isReviewing]);

  const validate = () => {
    if (!title.trim()) { setTitleError('Title is required.'); return false; }
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) { setTitleError(`Title must be ${MIN_WORDS} to ${MAX_WORDS} words.`); return false; }
    setTitleError('');
    return true;
  };

  const openReview = (event) => {
    event.preventDefault();
    setRequestError('');
    if (validate()) setIsReviewing(true);
    else requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const confirmSubmission = async () => {
    if (submissionPendingRef.current) return;
    if (!validate()) {
      setIsReviewing(false);
      return;
    }
    submissionPendingRef.current = true;
    setIsSubmitting(true);
    setRequestError('');
    try {
      await createSubmission({ title, category, keywords });
      setSubmitted(true);
      setIsReviewing(false);
      setTitle(''); setCategory(''); setKeywords('');
    } catch (error) {
      setRequestError(error.response?.data?.message || 'Unable to submit topic.');
      setIsReviewing(false);
    } finally {
      submissionPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="workspace-workflow">
      <h1 className="text-2xl font-bold text-text-primary">Submit Topic</h1>
      <section className="mt-5 rounded-[10px] border border-border-subtle bg-white p-6 shadow-card" role="status"><StatusBadge status="pending_review" /><h2 className="mt-4 text-xl font-bold">Topic submitted for review</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Your topic is now pending lecturer review. Track its status and any feedback in My Submissions.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-green px-4 font-semibold text-white" to="/student/my-submissions">View My Submissions</Link><Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 font-semibold" to="/student/dashboard">Return to Dashboard</Link></div></section>
    </div>
  );

  return (
    <div className="workspace-workflow">
      <header><h1 className="text-2xl font-bold text-text-primary">Submit Topic</h1><p className="mt-1 text-sm text-text-secondary">Submitting creates a pending topic for lecturer review.</p></header>
      {requestError && <div ref={errorRef} tabIndex="-1" role="alert" className="mt-5 border-l-4 border-feedback-danger bg-feedback-danger-bg p-4"><h2 className="font-bold text-feedback-danger">Submission failed</h2><p className="mt-1 text-sm text-feedback-danger">{requestError}</p></div>}
      <form onSubmit={openReview} noValidate className="mt-5 rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
        <div><label htmlFor="submission-title" className="text-sm font-semibold">Research Topic Title <span className="text-feedback-danger">*</span></label><textarea ref={titleInputRef} id="submission-title" rows="4" required value={title} onChange={(event) => { setTitle(event.target.value); if (titleError) setTitleError(''); }} aria-invalid={Boolean(titleError)} aria-describedby={`submission-title-help submission-title-count${titleError ? ' submission-title-error' : ''}`} disabled={isReviewing || isSubmitting} className={`mt-2 w-full rounded-md border bg-white px-3 py-2 ${titleError ? 'border-feedback-danger' : 'border-border-strong'}`} placeholder="Enter the topic title you want reviewed" /><p id="submission-title-help" className="mt-1 text-sm text-text-muted">Write a clear, specific title.</p><div id="submission-title-count" className="mt-2 flex justify-between gap-3 text-xs font-bold uppercase text-text-muted"><span>{wordCount} words</span><span>7–24 words required</span></div>{titleError && <p id="submission-title-error" className="mt-2 text-sm font-semibold text-feedback-danger">{titleError}</p>}</div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><label htmlFor="submission-category" className="text-sm font-semibold">Category <span className="font-normal text-text-muted">(optional)</span><input id="submission-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={isReviewing || isSubmitting} className="mt-2 block min-h-11 w-full rounded-md border border-border-strong px-3" placeholder="e.g. Epidemiology" /></label><label htmlFor="submission-keywords" className="text-sm font-semibold">Keywords <span className="font-normal text-text-muted">(optional)</span><input id="submission-keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} disabled={isReviewing || isSubmitting} className="mt-2 block min-h-11 w-full rounded-md border border-border-strong px-3" placeholder="Comma-separated" /></label></div>
        <p className="mt-5 text-sm text-text-secondary">Want advisory evidence first? <Link className="font-semibold underline" to="/student/check-my-topic">Check My Topic</Link>. This form does not run a similarity check.</p>
        {!isReviewing ? <div className="mt-5 border-t border-border-subtle pt-5"><PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>Review and submit</PrimaryButton></div> : <section ref={reviewRef} tabIndex="-1" className="mt-5 rounded-lg border border-border-strong bg-surface-muted p-4" aria-labelledby="review-title"><h2 id="review-title" className="text-xs font-bold uppercase text-text-muted">Before you submit</h2><p className="mt-2 break-words font-semibold">{title}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Category</dt><dd>{category || 'Not provided'}</dd></div><div><dt className="font-semibold">Keywords</dt><dd>{keywords || 'Not provided'}</dd></div></dl><p className="mt-3 text-sm text-text-secondary">Nothing has been saved yet. Confirming creates a pending topic for lecturer review.</p><div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><SecondaryButton type="button" onClick={() => { setIsReviewing(false); requestAnimationFrame(() => titleInputRef.current?.focus()); }} disabled={isSubmitting}>Back to edit</SecondaryButton><PrimaryButton type="button" onClick={confirmSubmission} isLoading={isSubmitting} disabled={isSubmitting}>Confirm submission</PrimaryButton></div><p className="sr-only" aria-live="polite">{isSubmitting ? 'Submitting topic for review.' : ''}</p></section>}
      </form>
    </div>
  );
}

export default SubmitTopicPage;
