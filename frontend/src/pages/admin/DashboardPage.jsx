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
    helper: 'Live admin health aggregation is not connected yet.'
  },
  {
    label: 'Database',
    helper: 'Database status requires a safe admin dashboard API.'
  },
  {
    label: 'SBERT',
    helper: 'Semantic engine status is planned for a future health endpoint.'
  }
];

const metricItems = [
  {
    label: 'Users',
    helper: 'Student, lecturer, and admin counts are not connected yet.'
  },
  {
    label: 'Topics',
    helper: 'Topic repository totals are not available yet.'
  },
  {
    label: 'Pending Reviews',
    helper: 'Admin-level pending review metrics are not connected yet.'
  },
  {
    label: 'High-risk Topics',
    helper: 'Risk summaries are unavailable without a safe analytics API.'
  }
];

const plannedStates = [
  'System overview with live service health',
  'Degraded health alert for semantic-analysis issues',
  'Critical outage view for unavailable core services'
];

function DashboardPage() {
  return (
    <AdminDashboardLayout>
      <PageHeader
        eyebrow="Admin portal"
        title="Admin Dashboard"
        subtitle="System oversight shell for health, metrics, and activity once a safe admin dashboard API exists."
      />

      <InfoCallout
        title="Admin metrics are not connected yet"
        message="This dashboard is presentation-only. It does not call backend services, create reports, expose restricted data, or present placeholder metrics as real."
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Service health</h2>
            <p className="text-sm text-text-secondary">
              ADMIN-01 health cards are ready for future API, database, and SBERT service status.
            </p>
          </div>
          <StatusBadge status="not_connected" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {serviceHealthItems.map((item) => (
            <DashboardStatusCard
              key={item.label}
              label={item.label}
              value="Not connected yet"
              helper={item.helper}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">System metrics</h2>
          <p className="text-sm text-text-secondary">
            Counts and analytics stay unavailable until the backend exposes a safe admin dashboard endpoint.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricItems.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value="Not available yet"
              helper={item.helper}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <EmptyStatePanel
          title="Recent activity is not connected yet"
          message="Audit events, report generation, user-management changes, and system activity require future admin APIs before they can be shown here."
        />

        <div className="rounded-card border border-border-subtle bg-white p-5 shadow-card">
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
    </AdminDashboardLayout>
  );
}

export default DashboardPage;
