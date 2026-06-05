import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

const unavailablePanels = [
  {
    title: 'Concentration heatmap unavailable',
    message: 'Topic concentration data needs enough real approved-topic records and an analytics endpoint.'
  },
  {
    title: 'Temporal trends tracking pending',
    message: 'Trend lines will remain hidden until real approved-topic dates can be queried safely.'
  },
  {
    title: 'Supervisor capacity data unavailable',
    message: 'Workload and capacity views require a supported supervisor assignment workflow.'
  },
  {
    title: 'Keyword clustering pending first reviews',
    message: 'Keyword clusters will only be useful after real submissions and approvals accumulate.'
  }
];

function ResearchTrendsPage() {
  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer analytics"
        title="Research Trends"
        subtitle="Trend analytics remain planned until real approved-topic data and a safe analytics endpoint are available."
        action={(
          <Link
            to="/lecturer/dashboard"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Dashboard
          </Link>
        )}
      />

      <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
        <div className="bg-[linear-gradient(145deg,#f8faf7,#fffdf7)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                Planned analytics
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-500">
                Research trend data unavailable.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                This page intentionally avoids fake charts, heatmaps, exports, topic counts, and workload metrics.
              </p>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              Soon
            </span>
          </div>
        </div>

        <div className="grid gap-4 bg-white p-5 sm:p-7">
          {unavailablePanels.map((panel) => (
            <article
              key={panel.title}
              className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center shadow-sm sm:p-8"
            >
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-400 shadow-sm">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 19V9" strokeLinecap="round" />
                  <path d="M12 19V5" strokeLinecap="round" />
                  <path d="M19 19v-7" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                {panel.title}
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                {panel.message}
              </p>
            </article>
          ))}
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default ResearchTrendsPage;
