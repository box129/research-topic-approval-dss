import { useNavigate } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import FilterDropdown from '../../components/ui/FilterDropdown';
import InfoCallout from '../../components/ui/InfoCallout';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SearchInput from '../../components/ui/SearchInput';
import SecondaryButton from '../../components/ui/SecondaryButton';
import StudentDashboardLayout from '../../layouts/StudentDashboardLayout';

const plannedInsightCards = [
  {
    label: 'Approved topics',
    value: 'Not connected yet',
    helper: 'Browsing will connect after a safe student read endpoint exists.',
    tone: 'info'
  },
  {
    label: 'Category discovery',
    value: 'Not available yet',
    helper: 'Category browsing is prepared but not connected to approved-topic data.',
    tone: 'neutral'
  },
  {
    label: 'Keyword trends',
    value: 'Coming later',
    helper: 'Keyword summaries will use approved-topic data when available.',
    tone: 'warning'
  },
  {
    label: 'Underexplored areas',
    value: 'No data available',
    helper: 'Opportunity summaries require a safe approved-topic dataset.',
    tone: 'success'
  }
];

function ResearchExplorerPage() {
  const navigate = useNavigate();

  return (
    <StudentDashboardLayout>
      <PageHeader
        eyebrow="Student portal"
        title="Research Explorer"
        subtitle="Discover approved-topic patterns once a safe student browsing endpoint is available."
      />

      <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="bg-[#f6fbf1] p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              Explorer shell
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-text-primary">
              Browse research patterns when approved-topic data is connected
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              The layout is prepared for discovery, filters, and topic browsing while staying honest about unavailable data.
            </p>
            <div className="mt-5">
              <InfoCallout
                title="Explorer-ready shell"
                message="This page is prepared for approved-topic browsing, but no student-safe read endpoint is connected yet."
              />
            </div>
          </div>

          <div className="border-t border-emerald-100 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="rounded-[1.25rem] border border-dashed border-brand-green-light bg-[#fbfdf8] p-5 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Research discovery is planned</p>
              <p className="mt-2">
                Search, filters, and insight areas stay disabled until approved-topic data can be exposed safely.
              </p>
              <div className="mt-4 grid gap-2">
                {['Search unavailable', 'Filters unavailable', 'Insights unavailable'].map((item) => (
                  <span key={item} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-text-muted shadow-sm">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-card sm:p-6" aria-label="Explorer controls">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              Discovery controls
            </p>
            <h2 className="text-xl font-semibold text-text-primary">Approved-topic browser</h2>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Disabled until connected
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
          <SearchInput
            id="research-explorer-search"
            label="Search approved topics"
            placeholder="Browsing is not connected yet"
            disabled
            helperText="Search will become available when approved-topic browsing is safely exposed."
          />
          <FilterDropdown
            id="research-explorer-category"
            label="Category"
            placeholder="All categories"
            disabled
            helperText="Filters are disabled until approved-topic data is available."
            options={[
              { value: 'epidemiology', label: 'Epidemiology' },
              { value: 'public-health', label: 'Public Health' }
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                Trending keywords
              </p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">Trend preview</h2>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Coming later
            </span>
          </div>
          <div className="mt-5 grid gap-2">
            {['Not connected yet', 'Not available yet', 'No data available'].map((item) => (
              <div key={item} className="rounded-[1rem] border border-dashed border-emerald-100 bg-[#f6fbf1] px-4 py-3 text-sm font-medium text-text-muted">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                Topic distribution
              </p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">Category overview</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
              No data available
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[14px] border-dashed border-emerald-100 bg-[#f6fbf1] text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
              Pending
            </div>
            <div className="space-y-3">
              {['Category coverage', 'Opportunity areas', 'Browsing availability'].map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#f6fbf1] px-4 py-3 text-sm">
                  <span className="font-medium text-text-primary">{item}</span>
                  <span className="text-text-muted">Not available yet</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plannedInsightCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            tone={card.tone}
          />
        ))}
      </div>

      <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-6" aria-label="Approved-topic table shell">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              Approved-topic table
            </p>
            <h2 className="text-xl font-semibold text-text-primary">Browsing area</h2>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">
            No rows available
          </span>
        </div>
        <div className="overflow-hidden rounded-[1.15rem] border border-border-subtle">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-[#f6fbf1] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <span>Topic title</span>
            <span>Category</span>
            <span>Availability</span>
          </div>
          <div className="px-4 py-6 text-sm text-text-secondary">
            Approved-topic browsing rows are unavailable until a safe endpoint is connected.
          </div>
        </div>
      </section>

      <EmptyStatePanel
        title="No approved topic explorer data is available yet."
        message="No approved-topic browsing endpoint is currently connected. You can still check an idea privately or submit a topic for review."
        action={(
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryButton type="button" onClick={() => navigate('/student/check-my-topic')}>
              Check My Topic
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/student/submit-topic')}>
              Submit Topic
            </SecondaryButton>
          </div>
        )}
      />
    </StudentDashboardLayout>
  );
}

export default ResearchExplorerPage;
