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
    value: 'Pending',
    helper: 'Browsing will connect after a safe student read endpoint exists.',
    tone: 'info'
  },
  {
    label: 'Category discovery',
    value: 'Pending',
    helper: 'Category browsing is prepared but not connected to approved-topic data.',
    tone: 'neutral'
  },
  {
    label: 'Keyword trends',
    value: 'Pending',
    helper: 'Keyword summaries will use approved-topic data when available.',
    tone: 'warning'
  },
  {
    label: 'Underexplored areas',
    value: 'Pending',
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

      <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)] lg:items-center">
          <InfoCallout
            title="Explorer-ready shell"
            message="This page is prepared for approved-topic browsing, but no student-safe read endpoint is connected yet."
          />
          <div className="rounded-[1rem] border border-dashed border-brand-green-light bg-[#f7fbf4] p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Research discovery is planned</p>
            <p className="mt-2">
              These controls stay disabled until approved-topic data can be exposed safely.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-border-subtle bg-white p-5 shadow-card sm:p-6" aria-label="Explorer controls">
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
