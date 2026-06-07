import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';

const plannedSections = [
  'Assignment list planned',
  'Progress status planned',
  'Topic tracking planned',
  'Review timeline planned'
];

function SuperviseesPage() {
  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer supervision"
        title="Supervisees"
        subtitle="Supervisee assignment and progress tracking remain deferred because no explicit assignment model is available yet."
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
                Supervision workspace
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20]">
                Assignment tracking is prepared, not live.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                This screen is ready to receive real supervisee assignments when the department workflow and API contract exist. Reviewed submissions are not treated as supervisees.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              No assigned data
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2" aria-label="Planned supervisee sections">
            {plannedSections.map((section) => (
              <span
                key={section}
                className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-text-muted shadow-sm"
              >
                {section}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="rounded-[1.5rem] border border-emerald-100 bg-[#fbfdf8] p-4 shadow-sm">
            <div className="grid gap-2 rounded-[1rem] bg-white p-2 sm:grid-cols-4">
              {['All students', 'Submitted', 'Pending', 'Awaiting revision'].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className={[
                    'rounded-[0.85rem] px-3 py-2 text-sm font-semibold',
                    index === 0 ? 'bg-[#1B5E20] text-white' : 'bg-slate-100 text-slate-500'
                  ].join(' ')}
                >
                  {label} unavailable
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-dashed border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f6fbf1] text-[#1B5E20]">
                <svg aria-hidden="true" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path d="M3.5 20a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
                  <path d="M13.5 19a3.5 3.5 0 0 1 7 0" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[#1B5E20]">No supervisee assignments connected yet</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                No student names, matric numbers, topic titles, statuses, or progress rows are shown because the current schema has no real supervisee assignment source or endpoint.
              </p>
            </div>
          </div>
        </div>
      </section>
    </LecturerDashboardLayout>
  );
}

export default SuperviseesPage;
