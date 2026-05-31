import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';

const serviceHealthItems = [
  {
    label: 'API',
    helper: 'Live admin health aggregation is not connected yet.',
    accent: 'border-emerald-500'
  },
  {
    label: 'Database',
    helper: 'Database status requires a safe admin dashboard API.',
    accent: 'border-amber-400'
  },
  {
    label: 'SBERT',
    helper: 'Semantic engine status is planned for a future health endpoint.',
    accent: 'border-sky-400'
  }
];

const metricItems = [
  {
    label: 'Users',
    helper: 'Student, lecturer, and admin counts are not connected yet.',
    accent: 'border-emerald-600'
  },
  {
    label: 'Topics',
    helper: 'Topic repository totals are not available yet.',
    accent: 'border-amber-500'
  },
  {
    label: 'Pending Reviews',
    helper: 'Admin-level pending review metrics are not connected yet.',
    accent: 'border-blue-500'
  },
  {
    label: 'High-risk Topics',
    helper: 'Risk summaries are unavailable without a safe analytics API.',
    accent: 'border-rose-400'
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
  'System overview with live service health',
  'Degraded health alert for semantic-analysis issues',
  'Critical outage view for unavailable core services'
];

function DashboardPage() {
  return (
    <AdminDashboardLayout className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-card">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="bg-emerald-950 p-6 text-white sm:p-8">
            <div className="flex h-full flex-col justify-between gap-8">
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-start">
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

          <div className="space-y-6 p-5 sm:p-6 lg:p-8">
            <InfoCallout
              title="Admin metrics are not connected yet"
              message="This dashboard is presentation-only. It does not call backend services, create reports, expose restricted data, or present placeholder metrics as real."
            />

            <section className="rounded-[1.5rem] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Service health</h2>
                  <p className="text-sm text-text-secondary">
                    ADMIN-01 health cards are ready for future API, database, and SBERT service status.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
                  Future health feed
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {serviceHealthItems.map((item) => (
                  <div key={item.label} className={`min-w-0 overflow-hidden rounded-[1.15rem] border border-border-subtle border-l-4 bg-[#fbfdf9] shadow-sm ${item.accent}`}>
                    <DashboardStatusCard
                      label={item.label}
                      value="Not connected yet"
                      helper={item.helper}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">System metrics</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Counts and analytics stay unavailable until the backend exposes a safe admin dashboard endpoint.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Placeholder values only
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {metricItems.map((item) => (
              <div key={item.label} className={`rounded-[1.1rem] border border-border-subtle border-l-4 bg-[#f8fbf7] ${item.accent}`}>
                <MetricCard
                  label={item.label}
                  value="Not available yet"
                  helper={item.helper}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Recent activity</h2>
              <p className="text-sm text-text-secondary">
                Figma-style activity area, kept empty until audit APIs are available.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Not connected yet
            </span>
          </div>
          <div className="pt-4">
            <EmptyStatePanel
              title="Recent activity is not connected yet"
              message="Audit events, report generation, user-management changes, and system activity require future admin APIs before they can be shown here."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Planned health states</h2>
          <p className="mt-1 text-sm text-text-secondary">
            These states are documented for ADMIN-01 but are not live system status in this PR.
          </p>
          <ul className="mt-4 space-y-3">
            {plannedStates.map((state) => (
              <li key={state} className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface-muted p-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
                <span>{state}</span>
                <span className="inline-flex w-fit shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-muted">
                  Preview only
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Deferred admin workflows</h2>
          <p className="mt-1 text-sm text-text-secondary">
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
