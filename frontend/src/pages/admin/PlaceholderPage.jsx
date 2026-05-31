import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';

const capabilityItems = [
  {
    label: 'Live data',
    helper: 'No admin API connection is attached to this surface.'
  },
  {
    label: 'Workflow actions',
    helper: 'No privileged operations or mutations are exposed here.'
  },
  {
    label: 'Reporting output',
    helper: 'No generated reports, exports, or analytics are available.'
  }
];

function AdminPlaceholderPage({ dashboardPath, message, subtitle, title }) {
  const dashboardAction = dashboardPath
    ? (
      <Link
        to={dashboardPath}
        className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
      >
        Back to Dashboard
      </Link>
    )
    : null;

  return (
    <AdminDashboardLayout>
      <PageHeader
        action={dashboardAction}
        eyebrow="Admin control room"
        title={title}
        subtitle={subtitle}
      />

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-card">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="bg-emerald-950 p-6 text-white sm:p-8">
            <div className="space-y-5">
              <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                Presentation-only
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Deferred admin workspace</p>
                <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/80">{message}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-green">Capability boundary</p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">Not connected yet</h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                This route keeps its place in the protected admin shell while backend-dependent behavior remains deferred.
              </p>
            </div>

            <div className="grid gap-3">
              {capabilityItems.map((item) => (
                <div key={item.label} className="rounded-[1rem] border border-border-subtle bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-emerald-950">{item.label}</p>
                    <span className="inline-flex w-fit rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
                      Deferred
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <EmptyStatePanel
        title={`${title} is not connected yet`}
        message="This protected route is intentionally presentation-only. A later scoped PR can connect real admin APIs and behavior after those contracts are approved."
      />

      <InfoCallout
        variant="warning"
        title="Deferred admin workflow"
        message="No placeholder records, fake metrics, live-health claims, import actions, exports, or privileged mutations are attached to this surface."
      />
    </AdminDashboardLayout>
  );
}

AdminPlaceholderPage.propTypes = {
  dashboardPath: PropTypes.string,
  message: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};

export default AdminPlaceholderPage;
