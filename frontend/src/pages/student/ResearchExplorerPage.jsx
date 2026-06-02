import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const discoveryCards = [
  {
    label: 'Trending Research Keywords',
    title: 'No trending data yet',
    message: 'Keyword patterns will appear after approved-topic browsing is safely connected.',
    indicator: '--'
  },
  {
    label: 'Topic Distribution',
    title: 'Waiting for topic approvals',
    message: 'Category distribution needs approved-topic data before it can be shown.',
    indicator: '+'
  },
  {
    label: 'Underexplored Areas',
    title: 'Explore areas will appear here',
    message: 'Opportunity areas cannot be identified until a safe dataset is available.',
    indicator: '?'
  }
];

function ResearchExplorerPage() {
  const navigate = useNavigate();

  return (
    <StudentDashboardLayout open>
      <header className="px-1 pt-1 sm:px-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Student portal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#1B5E20] sm:text-4xl">
          Research Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          Discover what&apos;s being researched, where the gaps are, and find inspiration for your topic.
        </p>
      </header>

      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50/65 px-4 py-3 shadow-sm sm:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">Explorer-ready shell</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          No student-safe read endpoint is connected yet. Discovery stays honest and empty until approved-topic
          browsing can be exposed safely.
        </p>
      </aside>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Research discovery previews">
        {discoveryCards.map((card) => (
          <article
            key={card.label}
            className="flex min-h-48 flex-col rounded-2xl border border-dashed border-emerald-200 bg-white/55 p-5 text-center sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1B5E20]">{card.label}</p>
            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-700/65"
              >
                {card.indicator}
              </span>
              <h2 className="mt-3 font-serif text-lg font-semibold text-[#1B5E20]">{card.title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-text-secondary">{card.message}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-emerald-200 bg-white/65 px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl font-light text-[#1B5E20]">
          +
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">Approved topics</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-[#1B5E20]">
          No approved topic explorer data is available yet.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          No approved-topic browsing endpoint is currently connected. You can still check an idea privately or
          submit a topic for review.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryButton
            type="button"
            aria-label="Submit Topic"
            className="!bg-[#1B5E20] hover:!bg-[#174F1C] focus-visible:!ring-[#1B5E20]"
            onClick={() => navigate('/student/submit-topic')}
          >
            Submit a Topic
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>
            Check My Topic
          </SecondaryButton>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4 sm:px-5" aria-label="Planned explorer controls">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Planned explorer controls</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Search and category browsing remain disabled until approved-topic data is safely available.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div>
            <label htmlFor="research-explorer-search" className="text-xs font-semibold text-text-primary">
              Search approved topics
            </label>
            <input
              id="research-explorer-search"
              type="search"
              value=""
              placeholder="Search unavailable"
              disabled
              readOnly
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm text-text-muted disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Search will become available when approved-topic browsing is safely exposed.
            </p>
          </div>
          <div>
            <label htmlFor="research-explorer-category" className="text-xs font-semibold text-text-primary">
              Category
            </label>
            <select
              id="research-explorer-category"
              disabled
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm text-text-muted disabled:cursor-not-allowed"
            >
              <option>All categories</option>
            </select>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Filters are disabled until approved-topic data is available.
            </p>
          </div>
        </div>
      </section>

      <p className="px-1 text-center text-xs leading-5 text-text-muted sm:px-0">
        Category discovery, keyword trends, and opportunity summaries are planned explorer features. No topic records,
        analytics, or recommendations are shown without a safe approved-topic dataset.
      </p>
    </StudentDashboardLayout>
  );
}

export default ResearchExplorerPage;
