import PropTypes from 'prop-types';
import SecondaryButton from '../../ui/SecondaryButton';

// Frozen Board C — C2 "Check could not run". This component encodes exactly one
// meaning: the similarity operation could not run because the checking service
// is unavailable. It is not an empty result, not zero matches, not validation,
// and never a property of the topic. Copy is frontend-authored product
// language; the backend failure payload is detection input only and its
// message is never interpolated here, so internal vocabulary (provider names,
// status codes, "semantic analysis") cannot leak into the student surface.
// Amber appears as a 3px edge rule only — a fault must never read as a
// similarity finding — and the retry rests in ink, never approval green.

function ProposalField({ label, value }) {
  return (
    <div>
      <dt className="font-bold">{label}</dt>
      <dd className="mt-1 break-words">{value || 'Not specified'}</dd>
    </div>
  );
}

ProposalField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string
};

function SimilarityCheckUnavailable({ proposal, onRetry, onEdit }) {
  return (
    <div className="border border-gray-200 border-l-[3px] border-l-brand-gold bg-white px-5 py-5 shadow-sm sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Check could not run</p>
      <h2 className="mt-2 text-xl font-bold leading-7 text-text-primary">
        Similarity checking is temporarily unavailable, so this check could not run.
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
        No similarity result was produced and no classification has been assigned.
      </p>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
        Nothing is wrong with your topic — this is a fault in the checking service, and your proposal has not been lost.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onRetry}
          data-testid="retry-check"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-input bg-text-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:ring-offset-2 sm:w-auto"
        >
          Try the check again
        </button>
        <SecondaryButton type="button" onClick={onEdit} data-testid="edit-proposal" className="min-h-11 w-full sm:w-auto">
          Edit proposal
        </SecondaryButton>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">If it keeps failing, contact your department administrator.</p>
      <section aria-labelledby="retained-proposal-title" className="mt-5 border-t border-gray-200 pt-4">
        <h3 id="retained-proposal-title" className="text-base font-bold text-text-primary">Your proposal, retained</h3>
        <p className="mt-2 break-words font-semibold text-text-primary" data-testid="retained-topic">{proposal?.topic}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <ProposalField label="Population" value={proposal?.population} />
          <ProposalField label="Location" value={proposal?.location} />
          <ProposalField label="Study focus" value={proposal?.studyFocus} />
        </dl>
        <p className="mt-3 text-sm text-text-secondary">Temporary browser state only. This proposal was not saved or submitted.</p>
      </section>
    </div>
  );
}

SimilarityCheckUnavailable.propTypes = {
  proposal: PropTypes.shape({
    topic: PropTypes.string,
    population: PropTypes.string,
    location: PropTypes.string,
    studyFocus: PropTypes.string
  }),
  onRetry: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired
};

export default SimilarityCheckUnavailable;
