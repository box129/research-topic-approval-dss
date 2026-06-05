import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

const disabledControls = [
  'Date range unavailable',
  'Outcome filter unavailable',
  'Risk filter unavailable',
  'Export unavailable'
];

function MyDecisionsPage() {
  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer records"
        title="My Decisions"
        subtitle="Decision history is prepared for a later workflow, but no decision-history endpoint is connected yet."
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
        <div className="bg-[linear-gradient(145deg,#f4fbef,#fffdf7)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                Decision archive
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20]">
                No decision history connected yet.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                Topics you approve, reject, or return for revision will appear here after a safe decision-history API is added.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              Planned workflow
            </span>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="rounded-[0.95rem] border border-slate-200 bg-white/70 px-4 py-3 text-sm text-text-muted">
              Search by student or topic once decision records are available
            </div>
            <button
              type="button"
              disabled
              className="rounded-input border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Export CSV unavailable
            </button>
            <button
              type="button"
              disabled
              className="rounded-input border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Export PDF unavailable
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Unavailable decision history controls">
            {disabledControls.map((control) => (
              <span
                key={control}
                className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm"
              >
                {control}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="rounded-[1.5rem] border border-dashed border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6fbf1] text-[#1B5E20]">
              <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 5h6" strokeLinecap="round" />
                <path d="M9 3h6v4H9z" />
                <path d="M7 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 18.5 6H17" />
                <path d="m8.5 13 2.25 2.25L15.5 10.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-5 text-xl font-semibold text-[#1B5E20]">No decisions recorded here yet</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              This page does not fabricate decision rows, exports, risk history, or expanded detail. It will display real records only after the v1 decision-history workflow is connected.
            </p>
          </div>
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default MyDecisionsPage;
