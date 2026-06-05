import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import StatusBadge from '../../components/ui/StatusBadge';

const serviceHealthItems = [
  {
    label: 'API',
    value: 'Not connected yet',
    helper: 'Live admin health aggregation is not connected yet.',
    tone: 'success',
    statusLabel: 'Not Connected',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800'
  },
  {
    label: 'Database',
    value: 'Not connected yet',
    helper: 'Database status requires a safe admin dashboard API.',
    tone: 'warning',
    statusLabel: 'Unavailable',
    border: 'border-l-amber-400',
    badge: 'bg-amber-50 text-amber-800'
  },
  {
    label: 'SBERT',
    value: 'Not connected yet',
    helper: 'Semantic engine status is planned for a future health endpoint.',
    tone: 'info',
    statusLabel: 'Planned',
    border: 'border-l-sky-400',
    badge: 'bg-sky-50 text-sky-800'
  }
];

const metricItems = [
  {
    label: 'Users',
    helper: 'Student, lecturer, and admin counts are not connected yet.',
    accent: 'border-l-emerald-600'
  },
  {
    label: 'Topics',
    helper: 'Topic repository totals are not available yet.',
    accent: 'border-l-amber-500'
  },
  {
    label: 'Pending Reviews',
    helper: 'Admin-level pending review metrics are not connected yet.',
    accent: 'border-l-blue-500'
  },
  {
    label: 'High-risk Topics',
    helper: 'Risk summaries are unavailable without a safe analytics API.',
    accent: 'border-l-rose-500'
  }
];

const deferredWorkflowItems = [
  {
    label: 'User management',
    helper: 'Account provisioning and role administration remain unavailable until a safe admin API exists.'
  },
  {
    label: 'Reports',
    helper: 'Usage reports and exports are planned, but no report data is generated or displayed here.'
  },
  {
    label: 'Audit logs',
    helper: 'Audit events are not connected yet and no fake activity is shown in this dashboard shell.'
  },
  {
    label: 'Data import',
    helper: 'Import/export workflows remain deferred and no file-processing behavior is attached.'
  }
];

const plannedStates = [
  {
    label: 'Normal system dashboard',
    helper: 'ADMIN_01_S1 visual state, awaiting a safe live health feed.',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-100'
  },
  {
    label: 'Degraded semantic service state',
    helper: 'ADMIN_01_S2 preview only; no SBERT outage is claimed here.',
    tone: 'bg-amber-50 text-amber-800 border-amber-100'
  },
  {
    label: 'Critical database unavailable state',
    helper: 'ADMIN_01_S3 preview only; no database outage is claimed here.',
    tone: 'bg-rose-50 text-rose-800 border-rose-100'
  }
];

function ServiceHealthCard({ item }) {
  return (
    <article className={`rounded-[1.1rem] border border-border-subtle border-l-4 ${item.border} bg-white p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{item.label}</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">{item.value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${item.badge}`}>
          {item.statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-text-secondary">{item.helper}</p>
    </article>
  );
}

function AdminMetricCard({ item }) {
  return (
    <article className={`rounded-[1rem] border border-border-subtle border-l-4 ${item.accent} bg-white p-4 shadow-sm`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{item.label}</p>
      <p className="mt-2 text-xl font-semibold text-text-primary">Not available yet</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{item.helper}</p>
    </article>
  );
}

function DashboardPage() {
  return (
    <AdminDashboardLayout className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)]">
        <div className="grid gap-0 xl:grid-cols-[0.84fr_1.16fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Admin control room
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Admin portal</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">Admin Dashboard</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">
                    System oversight shell for health, metrics, and activity once a safe admin dashboard API exists.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                      Current feed
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">Not connected yet</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-950">
                    <span>System status: Not connected yet</span>
                    <StatusBadge status="not_connected" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-50/75">
                  This surface mirrors the ADMIN-01 dashboard shape without implying live system status.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div className="rounded-[1.4rem] border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-800">
              <p className="font-semibold text-blue-900">Admin metrics are not connected yet</p>
              <p>
                This dashboard is presentation-only. It does not call backend services, create reports, expose restricted data, or present placeholder metrics as real.
              </p>
            </div>

            <section className="rounded-[1.5rem] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Service health</h2>
                  <p className="text-sm leading-6 text-text-secondary">
                    ADMIN-01 health cards are ready for future API, database, and SBERT service status.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
                  Future health feed
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {serviceHealthItems.map((item) => (
                  <ServiceHealthCard key={item.label} item={item} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">System metrics</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
                Counts and analytics stay unavailable until the backend exposes a safe admin dashboard endpoint.
              </p>
            </div>
            <span className="inline-flex w-fit shrink-0 rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Placeholder values only
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {metricItems.map((item) => (
              <AdminMetricCard key={item.label} item={item} />
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Recent activity</h2>
              <p className="text-sm leading-6 text-text-secondary">
                Figma-style activity area, kept empty until audit APIs are available.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Not connected yet
            </span>
          </div>
          <div className="pt-4">
            <EmptyStatePanel
              className="min-h-52"
              title="Recent activity is not connected yet"
              message="Audit events, report generation, user-management changes, and system activity require future admin APIs before they can be shown here."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">ADMIN-01 state previews</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Normal, degraded, and critical dashboard states are represented as preview-only references, not live system status in this PR.
          </p>
          <ul className="mt-4 grid gap-3">
            {plannedStates.map((state) => (
              <li key={state.label} className={`rounded-[1rem] border p-4 text-sm ${state.tone}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{state.label}</span>
                  <span className="inline-flex w-fit shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-xs font-semibold">
                    Preview only
                  </span>
                </div>
                <p className="mt-2 leading-5 opacity-85">{state.helper}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Deferred admin workflows</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Admin operations are shown as Figma-style placeholders until safe backend support exists.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {deferredWorkflowItems.map((item) => (
              <div key={item.label} className="rounded-[1rem] border border-dashed border-emerald-900/20 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-950">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{item.helper}</p>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted">
                  Coming later
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <InfoCallout
              variant="warning"
              title="Deferred admin workflows"
              message="User management, reports, audit logs, settings, data import, live health checks, exports, and similarity analytics remain out of scope for this dashboard PR."
            />
          </div>
        </div>
      </section>
    </AdminDashboardLayout>
  );
}

export default DashboardPage;
