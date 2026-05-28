import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import DashboardStatusCard from '../../components/ui/DashboardStatusCard';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
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

const plannedStates = [
  'System overview with live service health',
  'Degraded health alert for semantic-analysis issues',
  'Critical outage view for unavailable core services'
];

function DashboardPage() {
  return (
    <AdminDashboardLayout className="-mx-2 -my-2 rounded-[1.5rem] bg-[#f1f5ef] p-4 sm:-mx-3 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[1.35rem] border border-emerald-900/10 bg-white shadow-card">
        <div className="border-b border-border-subtle bg-gradient-to-r from-white via-white to-emerald-50/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <PageHeader
              eyebrow="Admin portal"
              title="Admin Dashboard"
              subtitle="System oversight shell for health, metrics, and activity once a safe admin dashboard API exists."
            />
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
              <span>System status: Not connected yet</span>
              <StatusBadge status="not_connected" />
            </div>
          </div>
        </div>

        <div className="space-y-7 p-4 sm:p-6">
          <InfoCallout
            title="Admin metrics are not connected yet"
            message="This dashboard is presentation-only. It does not call backend services, create reports, expose restricted data, or present placeholder metrics as real."
          />

          <section className="rounded-[1.25rem] border border-emerald-900/10 bg-[#f8fbf7] p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Service health</h2>
                <p className="text-sm text-text-secondary">
                  ADMIN-01 health cards are ready for future API, database, and SBERT service status.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-border-subtle bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                Future health feed
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {serviceHealthItems.map((item) => (
                <div key={item.label} className={`rounded-card border-l-4 bg-white ${item.accent}`}>
                  <DashboardStatusCard
                    label={item.label}
                    value="Not connected yet"
                    helper={item.helper}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">System metrics</h2>
                <p className="text-sm text-text-secondary">
                  Counts and analytics stay unavailable until the backend exposes a safe admin dashboard endpoint.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Placeholder values only
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricItems.map((item) => (
                <div key={item.label} className={`rounded-card border-l-4 bg-white ${item.accent}`}>
                  <MetricCard
                    label={item.label}
                    value="Not available yet"
                    helper={item.helper}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[1.25rem] border border-border-subtle bg-white p-2 shadow-sm">
              <EmptyStatePanel
                title="Recent activity is not connected yet"
                message="Audit events, report generation, user-management changes, and system activity require future admin APIs before they can be shown here."
              />
            </div>

            <div className="rounded-[1.25rem] border border-border-subtle bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">Planned health states</h2>
              <p className="mt-1 text-sm text-text-secondary">
                These states are documented for ADMIN-01 but are not live system status in this PR.
              </p>
              <ul className="mt-4 space-y-3">
                {plannedStates.map((state) => (
                  <li key={state} className="rounded-card border border-border-subtle bg-surface-muted p-3 text-sm text-text-secondary">
                    {state}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <InfoCallout
            variant="warning"
            title="Deferred admin workflows"
            message="User management, reports, audit logs, settings, data import, live health checks, exports, and similarity analytics remain out of scope for this dashboard PR."
          />
        </div>
      </section>
    </AdminDashboardLayout>
  );
}

export default DashboardPage;
