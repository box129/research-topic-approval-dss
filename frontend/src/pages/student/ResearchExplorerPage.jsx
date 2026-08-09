import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';

function ResearchExplorerPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-5xl">
      <header><h1 className="text-2xl font-bold text-text-primary">Research Explorer</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">Approved-topic browsing is not currently available in the Student workspace. You can still check a proposed topic for similarity or submit a topic for lecturer review.</p></header>
      <section className="mt-5 rounded-[10px] border border-border-subtle bg-white p-5 shadow-card sm:p-6" aria-label="Unavailable research explorer controls">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <label htmlFor="research-explorer-search" className="text-sm font-semibold">Search approved topics<input id="research-explorer-search" type="search" placeholder="Not currently available" disabled className="mt-2 block min-h-11 w-full rounded-md border border-border-strong bg-gray-100 px-3 text-text-muted" /></label>
          <label htmlFor="research-explorer-category" className="text-sm font-semibold">Category<select id="research-explorer-category" disabled className="mt-2 block min-h-11 w-full rounded-md border border-border-strong bg-gray-100 px-3 text-text-muted"><option>Not currently available</option></select></label>
        </div>
      </section>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><PrimaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>Check My Topic</PrimaryButton><SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>Submit Topic</SecondaryButton></div>
    </div>
  );
}

export default ResearchExplorerPage;
