import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createRevisionSubmission, createSubmission, listSubmissions } from '../../api/submissions';
import LoadingState from '../../components/ui/LoadingState';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StatusBadge from '../../components/ui/StatusBadge';

const MIN_WORDS = 7;
const MAX_WORDS = 24;
const countWords = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

const CONTEXT_INPUT_CLASS = 'mt-2 block min-h-11 w-full rounded-md border border-border-strong px-3';

/**
 * Serves both a first submission and a revision of an existing one.
 *
 * A revision is a new submission linked to the original, never an edit of it, so
 * the two paths share every rule that matters — title bounds, the
 * review-before-submit step, and the in-flight guard that stops a double click
 * creating two submissions. The only differences are where the form starts from,
 * what copy it shows, and which endpoint it posts to. Keeping them in one
 * component is what stops the revision path quietly drifting from the rules the
 * first submission enforces.
 *
 * Population, location and study focus are collected here for the same reason
 * Check My Topic collects them: a submitted topic is embedded from exactly the
 * same structured representation as a pre-check, so what the student supplies
 * in one must be what the system sees in the other.
 */
function SubmitTopicPage() {
  const { submissionId } = useParams();
  const isRevision = Boolean(submissionId);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [population, setPopulation] = useState('');
  const [location, setLocation] = useState('');
  const [studyFocus, setStudyFocus] = useState('');
  const [titleError, setTitleError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [original, setOriginal] = useState(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(isRevision);
  const [ineligibleReason, setIneligibleReason] = useState('');
  const errorRef = useRef(null);
  const reviewRef = useRef(null);
  const submissionPendingRef = useRef(false);
  const titleInputRef = useRef(null);
  const wordCount = useMemo(() => countWords(title), [title]);
  const fieldsLocked = isReviewing || isSubmitting;

  // The student's own submission list already carries lineage, feedback and the
  // semantic context, so starting a revision needs no extra endpoint.
  const loadOriginal = useCallback(async () => {
    if (!isRevision) return;
    setIsLoadingOriginal(true);
    setIneligibleReason('');
    try {
      const submissions = await listSubmissions();
      const match = submissions.find((item) => String(item.id) === String(submissionId));

      if (!match) {
        setIneligibleReason('That submission could not be found in your submission history.');
      } else if (String(match.status).toLowerCase() !== 'awaiting_revision') {
        setIneligibleReason('That submission is not awaiting a revision, so it cannot be revised.');
      } else if (match.has_revision) {
        setIneligibleReason('You have already submitted a revision of that topic.');
      } else {
        setOriginal(match);
        // Start from everything that was already proposed — including the
        // context the original was embedded from — so the student edits rather
        // than retypes, and never has to remember what was asked for.
        setTitle(match.title || '');
        setCategory(match.category || '');
        setKeywords(match.keywords || '');
        setPopulation(match.population || '');
        setLocation(match.location || '');
        setStudyFocus(match.study_focus || '');
      }
    } catch (error) {
      setIneligibleReason(error.response?.data?.message || 'Unable to load the submission you want to revise.');
    } finally {
      setIsLoadingOriginal(false);
    }
  }, [isRevision, submissionId]);

  useEffect(() => {
    loadOriginal();
  }, [loadOriginal]);

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
    const payload = { title, category, keywords, population, location, studyFocus };
    try {
      if (isRevision) {
        await createRevisionSubmission(submissionId, payload);
      } else {
        await createSubmission(payload);
      }
      setSubmitted(true);
      setIsReviewing(false);
      if (!isRevision) {
        setTitle(''); setCategory(''); setKeywords('');
        setPopulation(''); setLocation(''); setStudyFocus('');
      }
    } catch (error) {
      setRequestError(error.response?.data?.message || (isRevision ? 'Unable to submit revision.' : 'Unable to submit topic.'));
      setIsReviewing(false);
    } finally {
      submissionPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const heading = isRevision ? 'Revise and Resubmit' : 'Submit Topic';

  if (isRevision && isLoadingOriginal) {
    return (
      <div className="workspace-workflow">
        <h1 className="text-2xl font-bold text-text-primary">{heading}</h1>
        <LoadingState label="Loading the submission you want to revise" />
      </div>
    );
  }

  if (isRevision && ineligibleReason) {
    return (
      <div className="workspace-workflow">
        <h1 className="text-2xl font-bold text-text-primary">{heading}</h1>
        <section className="mt-5 rounded-[10px] border border-border-subtle bg-white p-6 shadow-card" role="alert" data-testid="revision-unavailable">
          <h2 className="text-lg font-bold text-text-primary">This topic cannot be revised</h2>
          <p className="mt-2 break-words text-sm leading-6 text-text-secondary">{ineligibleReason}</p>
          <div className="mt-5"><Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 font-semibold" to="/student/my-submissions">Back to My Submissions</Link></div>
        </section>
      </div>
    );
  }

  if (submitted) return (
    <div className="workspace-workflow">
      <h1 className="text-2xl font-bold text-text-primary">{heading}</h1>
      <section className="mt-5 rounded-[10px] border border-border-subtle bg-white p-6 shadow-card" role="status" data-testid="submission-confirmation"><StatusBadge status="pending_review" /><h2 className="mt-4 text-xl font-bold">{isRevision ? 'Revision submitted for review' : 'Topic submitted for review'}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{isRevision ? 'Your revised topic is now pending lecturer review. Your original submission is kept in your history alongside the feedback that led to this revision.' : 'Your topic is now pending lecturer review. Track its status and any feedback in My Submissions.'}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-green px-4 font-semibold text-white" to="/student/my-submissions">View My Submissions</Link><Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 font-semibold" to="/student/dashboard">Return to Dashboard</Link></div></section>
    </div>
  );

  return (
    <div className="workspace-workflow">
      <header><h1 className="text-2xl font-bold text-text-primary">{heading}</h1><p className="mt-1 text-sm text-text-secondary">{isRevision ? 'Edit your topic in response to the feedback below. This creates a new submission linked to your original — the original is kept, not replaced.' : 'Submitting creates a pending topic for lecturer review.'}</p></header>

      {isRevision && original && (
        <section
          className="mt-5 rounded-[10px] border-l-4 border-status-revision bg-white p-5 shadow-card"
          aria-labelledby="revision-feedback-heading"
          data-testid="revision-feedback"
        >
          <h2 id="revision-feedback-heading" className="text-xs font-bold uppercase tracking-wider text-text-muted">Lecturer feedback to address</h2>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-text-primary">
            {original.decision_reason || 'No feedback was recorded with this request.'}
          </p>
          <dl className="mt-4 space-y-1 text-sm text-text-secondary">
            <div><dt className="inline font-semibold">Original topic:</dt> <dd className="inline break-words">{original.title}</dd></div>
            {formatDate(original.submitted_at) && (
              <div><dt className="inline font-semibold">Originally submitted:</dt> <dd className="inline">{formatDate(original.submitted_at)}</dd></div>
            )}
          </dl>
        </section>
      )}

      {requestError && <div ref={errorRef} tabIndex="-1" role="alert" className="mt-5 border-l-4 border-feedback-danger bg-feedback-danger-bg p-4"><h2 className="font-bold text-feedback-danger">{isRevision ? 'Revision failed' : 'Submission failed'}</h2><p className="mt-1 break-words text-sm text-feedback-danger">{requestError}</p></div>}
      <form onSubmit={openReview} noValidate className="mt-5 rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6">
        <div><label htmlFor="submission-title" className="text-sm font-semibold">Research Topic Title <span className="text-feedback-danger">*</span></label><textarea ref={titleInputRef} id="submission-title" rows="4" required value={title} onChange={(event) => { setTitle(event.target.value); if (titleError) setTitleError(''); }} aria-invalid={Boolean(titleError)} aria-describedby={`submission-title-help submission-title-count${titleError ? ' submission-title-error' : ''}`} disabled={fieldsLocked} className={`mt-2 w-full rounded-md border bg-white px-3 py-2 ${titleError ? 'border-feedback-danger' : 'border-border-strong'}`} placeholder="Enter the topic title you want reviewed" /><p id="submission-title-help" className="mt-1 text-sm text-text-muted">Write a clear, specific title.</p><div id="submission-title-count" className="mt-2 flex justify-between gap-3 text-xs font-bold uppercase text-text-muted"><span>{wordCount} words</span><span>7–24 words required</span></div>{titleError && <p id="submission-title-error" className="mt-2 text-sm font-semibold text-feedback-danger">{titleError}</p>}</div>

        <fieldset className="mt-5" aria-describedby="submission-context-help">
          <legend className="text-sm font-semibold">Research context <span className="font-normal text-text-muted">(optional)</span></legend>
          <p id="submission-context-help" className="mt-1 text-sm text-text-muted">Population, location and study focus are included in the similarity comparison when supplied — the same way Check My Topic uses them.</p>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <label htmlFor="submission-population" className="text-sm font-semibold">Population<input id="submission-population" value={population} onChange={(event) => setPopulation(event.target.value)} disabled={fieldsLocked} maxLength={1000} className={CONTEXT_INPUT_CLASS} placeholder="e.g. Mothers of children under five" /></label>
            <label htmlFor="submission-location" className="text-sm font-semibold">Location<input id="submission-location" value={location} onChange={(event) => setLocation(event.target.value)} disabled={fieldsLocked} maxLength={1000} className={CONTEXT_INPUT_CLASS} placeholder="e.g. Osogbo" /></label>
          </div>
          <label htmlFor="submission-study-focus" className="mt-5 block text-sm font-semibold">Study focus<textarea id="submission-study-focus" rows="2" value={studyFocus} onChange={(event) => setStudyFocus(event.target.value)} disabled={fieldsLocked} maxLength={1000} className="mt-2 block w-full rounded-md border border-border-strong px-3 py-2" placeholder="e.g. Malaria prevention knowledge" /></label>
        </fieldset>

        <div className="mt-5 grid gap-5 sm:grid-cols-2"><label htmlFor="submission-category" className="text-sm font-semibold">Category <span className="font-normal text-text-muted">(optional)</span><input id="submission-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={fieldsLocked} className={CONTEXT_INPUT_CLASS} placeholder="e.g. Epidemiology" /></label><label htmlFor="submission-keywords" className="text-sm font-semibold">Keywords <span className="font-normal text-text-muted">(optional)</span><input id="submission-keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} disabled={fieldsLocked} className={CONTEXT_INPUT_CLASS} placeholder="Comma-separated" /></label></div>
        <p className="mt-5 text-sm text-text-secondary">Want advisory evidence first? <Link className="font-semibold underline" to="/student/check-my-topic">Check My Topic</Link>. This form does not run a similarity check.</p>
        {!isReviewing ? <div className="mt-5 border-t border-border-subtle pt-5"><PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>{isRevision ? 'Review and resubmit' : 'Review and submit'}</PrimaryButton></div> : <section ref={reviewRef} tabIndex="-1" className="mt-5 rounded-lg border border-border-strong bg-surface-muted p-4" aria-labelledby="review-title"><h2 id="review-title" className="text-xs font-bold uppercase text-text-muted">Before you submit</h2><p className="mt-2 break-words font-semibold">{title}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Population</dt><dd className="break-words">{population.trim() || 'Not provided'}</dd></div><div><dt className="font-semibold">Location</dt><dd className="break-words">{location.trim() || 'Not provided'}</dd></div><div className="sm:col-span-2"><dt className="font-semibold">Study focus</dt><dd className="break-words">{studyFocus.trim() || 'Not provided'}</dd></div><div><dt className="font-semibold">Category</dt><dd>{category || 'Not provided'}</dd></div><div><dt className="font-semibold">Keywords</dt><dd>{keywords || 'Not provided'}</dd></div></dl><p className="mt-3 text-sm text-text-secondary">{isRevision ? 'Nothing has been saved yet. Confirming creates a new submission linked to your original and sends it for lecturer review.' : 'Nothing has been saved yet. Confirming creates a pending topic for lecturer review.'}</p><div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><SecondaryButton type="button" onClick={() => { setIsReviewing(false); requestAnimationFrame(() => titleInputRef.current?.focus()); }} disabled={isSubmitting}>Back to edit</SecondaryButton><PrimaryButton type="button" onClick={confirmSubmission} isLoading={isSubmitting} disabled={isSubmitting}>{isRevision ? 'Confirm revision' : 'Confirm submission'}</PrimaryButton></div><p className="sr-only" aria-live="polite">{isSubmitting ? 'Submitting topic for review.' : ''}</p></section>}
      </form>
    </div>
  );
}

export default SubmitTopicPage;
