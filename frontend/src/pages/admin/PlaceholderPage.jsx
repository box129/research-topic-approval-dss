import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';

const DEFAULT_PROFILE = {
  eyebrow: 'Deferred admin workspace',
  panelTitle: 'Capability boundary',
  boundaryTitle: 'Not connected yet',
  boundaryCopy: 'This route keeps its place in the protected admin shell while backend-dependent behavior remains deferred.',
  controls: ['Live data unavailable', 'Actions disabled', 'Exports unavailable'],
  surfaces: [
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
  ],
  emptyTitle: 'Workspace data is not connected yet',
  emptyMessage: 'No records, metrics, exports, reports, or privileged operations are shown until approved backend support exists.'
};

const PAGE_PROFILES = {
  'User Management': {
    eyebrow: 'Account administration',
    panelTitle: 'User management shell',
    boundaryTitle: 'User records are not connected yet',
    boundaryCopy: 'Search, role filters, invitations, account status, and profile actions need safe admin APIs before any user data appears.',
    controls: ['Search users unavailable', 'Role filters unavailable', 'Add user unavailable'],
    surfaces: [
      {
        label: 'User table',
        helper: 'No student, lecturer, or admin rows are fabricated for this protected route.'
      },
      {
        label: 'Role management',
        helper: 'Role changes and account status actions remain disabled until privileged mutations are approved.'
      },
      {
        label: 'Account activity',
        helper: 'Last-active values and supervisor assignments require real user records before display.'
      }
    ],
    emptyTitle: 'No user-management data connected yet',
    emptyMessage: 'The Figma-style user table, search, tabs, and add-user affordance remain presentation-only. No fake users or privileged account actions are exposed.'
  },
  'Topic Repository': {
    eyebrow: 'Repository oversight',
    panelTitle: 'Topic repository shell',
    boundaryTitle: 'Topic records are not connected yet',
    boundaryCopy: 'Repository search, import status, duplicate checks, migration controls, and topic administration require real repository APIs.',
    controls: ['Search topics unavailable', 'Import unavailable', 'Migration unavailable'],
    surfaces: [
      {
        label: 'Topic table',
        helper: 'No title, supervisor, category, year, or status rows are fabricated.'
      },
      {
        label: 'Repository filters',
        helper: 'Year, category, source, and status filtering remain disabled until real data exists.'
      },
      {
        label: 'Import workflows',
        helper: 'CSV/Excel import, manual entry, and duplicate actions are not attached to this placeholder.'
      }
    ],
    emptyTitle: 'No topic repository data connected yet',
    emptyMessage: 'This route keeps the repository command surface visible without adding fake topic rows, import controls, duplicate results, or migration actions.'
  },
  'System Settings': {
    eyebrow: 'Configuration control',
    panelTitle: 'System settings shell',
    boundaryTitle: 'Settings are not connected yet',
    boundaryCopy: 'Thresholds, email templates, permission controls, and logs require approved configuration APIs and validation rules.',
    controls: ['Threshold controls disabled', 'Templates unavailable', 'Save changes unavailable'],
    surfaces: [
      {
        label: 'Similarity thresholds',
        helper: 'No threshold sliders, impact preview values, or save behavior are active.'
      },
      {
        label: 'Email templates',
        helper: 'Template editing and notification behavior remain deferred.'
      },
      {
        label: 'System logs',
        helper: 'Configuration logs are not fetched or displayed in this visual placeholder.'
      }
    ],
    emptyTitle: 'No settings controls connected yet',
    emptyMessage: 'The settings page is visually prepared for configuration management, but no values, previews, save actions, or mutations are available.'
  },
  'Audit Log': {
    eyebrow: 'Audit visibility',
    panelTitle: 'Audit log shell',
    boundaryTitle: 'Audit records are not connected yet',
    boundaryCopy: 'Audit filters, event types, user selectors, detail drawers, and export controls require a real audit endpoint.',
    controls: ['Date filter unavailable', 'Event filter unavailable', 'Export unavailable'],
    surfaces: [
      {
        label: 'Event table',
        helper: 'No login, decision, import, settings, or user-management rows are fabricated.'
      },
      {
        label: 'Filter controls',
        helper: 'Date range, event type, user search, and keyword search are disabled until audit data exists.'
      },
      {
        label: 'Audit detail',
        helper: 'Detail views and CSV export remain deferred and no action buttons are attached.'
      }
    ],
    emptyTitle: 'No audit events connected yet',
    emptyMessage: 'This protected route preserves the audit-log shape without fake activity, timestamps, actors, IP addresses, or export behavior.'
  },
  Reports: {
    eyebrow: 'Reporting center',
    panelTitle: 'Reports shell',
    boundaryTitle: 'Report data is not connected yet',
    boundaryCopy: 'Department analytics, trend charts, export files, and performance metrics require approved reporting APIs.',
    controls: ['Date range unavailable', 'Export CSV unavailable', 'Export PDF unavailable'],
    surfaces: [
      {
        label: 'Report metrics',
        helper: 'No approval totals, supervisor ratios, decision times, or pipeline counts are fabricated.'
      },
      {
        label: 'Charts and heatmaps',
        helper: 'Distribution heatmaps, temporal charts, and keyword lists remain unavailable.'
      },
      {
        label: 'Exports',
        helper: 'CSV and PDF exports are presentation-only and do not generate files.'
      }
    ],
    emptyTitle: 'No reporting data connected yet',
    emptyMessage: 'Reports keep their place in the admin shell without fake metrics, charts, exports, report rows, or backend calls.'
  }
};

function getProfile(title) {
  return PAGE_PROFILES[title] || DEFAULT_PROFILE;
}

function AdminPlaceholderPage({ dashboardPath, message, subtitle, title }) {
  const profile = getProfile(title);
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

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.65)]">
        <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Presentation-only
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">{profile.eyebrow}</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/80">{message}</p>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
                  Connection state
                </p>
                <p className="mt-1 text-xl font-semibold text-white">Not connected yet</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                  The route is protected and navigable, but workflow data and mutations remain unavailable.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-green">{profile.panelTitle}</p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">{profile.boundaryTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                {profile.boundaryCopy}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {profile.controls.map((control) => (
                <div key={control} className="rounded-[1rem] border border-border-subtle bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Unavailable</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{control}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              {profile.surfaces.map((item) => (
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

      <section className="grid items-start gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <EmptyStatePanel
          title={`${title} is not connected yet`}
          message={profile.emptyMessage}
        />

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Unsupported features deferred</h2>
              <p className="text-sm leading-6 text-text-secondary">
                The Figma surface is represented without backend-dependent claims or fake data.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Deferred admin workflow
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              'No placeholder records',
              'No fake metrics',
              'No import or export actions',
              'No privileged mutations'
            ].map((item) => (
              <div key={item} className="rounded-[0.9rem] border border-dashed border-emerald-900/20 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-950">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <InfoCallout
              variant="warning"
              title="Deferred admin workflow"
              message="No placeholder records, fake metrics, live-health claims, import actions, exports, or privileged mutations are attached to this surface."
            />
          </div>
        </div>
      </section>

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
