import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import StatusBadge from '../../components/ui/StatusBadge';
import { getAdminDashboardSummary } from '../../api/admin';

const deferredWorkflowItems = [
  {
    label: 'User management',
    helper: 'Account provisioning and role administration remain unavailable until safe admin user APIs exist.'
  },
  {
    label: 'Reports',
    helper: 'Usage reports and exports are planned, but no report data is generated or displayed here.'
  },
  {
    label: 'Audit logs',
    helper: 'Audit storage exists, but this dashboard does not fabricate activity or connect an activity feed.'
  },
  {
    label: 'Data import',
    helper: 'Import endpoints are admin-protected; dashboard import controls remain out of scope here.'
  }
];

const plannedStates = [
  {
    label: 'Normal system dashboard',
    helper: 'ADMIN_01_S1 visual state, now backed by safe read-only count sections where available.',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-100'
  },
  {
    label: 'Degraded semantic service state',
    helper: 'ADMIN_01_S2 preview only; SBERT health remains unknown unless a future health check connects it.',
    tone: 'bg-amber-50 text-amber-800 border-amber-100'
  },
  {
    label: 'Critical database unavailable state',
    helper: 'ADMIN_01_S3 preview only; database errors are shown only when the read-only summary reports one.',
    tone: 'bg-rose-50 text-rose-800 border-rose-100'
  }
];

const healthStyles = {
  available: {
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800',
    value: 'Available',
    statusLabel: 'Available'
  },
  unavailable: {
    border: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-800',
    value: 'Unavailable',
    statusLabel: 'Unavailable'
  },
  unknown: {
    border: 'border-l-sky-400',
    badge: 'bg-sky-50 text-sky-800',
    value: 'Unknown',
    statusLabel: 'Unknown'
  },
  loading: {
    border: 'border-l-blue-400',
    badge: 'bg-blue-50 text-blue-800',
    value: 'Loading...',
    statusLabel: 'Loading'
  }
};

const metricAccents = {
  users: 'border-l-emerald-600',
  topics: 'border-l-amber-500',
  submissions: 'border-l-blue-500',
  similarityChecks: 'border-l-rose-500'
};

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : 'Unavailable';
}

function formatCountWithLabel(value, singular, plural = `${singular}s`) {
  return `${formatCount(value)} ${value === 1 ? singular : plural}`;
}

function getHealthStyle(status) {
  return healthStyles[status] || healthStyles.unknown;
}

function buildStatusBadgeStatus(status) {
  if (status === 'available') {
    return 'approved';
  }

  if (status === 'unavailable') {
    return 'rejected';
  }

  if (status === 'loading') {
    return 'pending_review';
  }

  return 'not_connected';
}

function buildServiceHealthItems({ summary, isLoading, hasError }) {
  if (isLoading) {
    return ['API', 'Database', 'SBERT'].map((label) => ({
      label,
      value: 'Loading...',
      helper: 'Reading the read-only admin dashboard summary.',
      status: 'loading'
    }));
  }

  if (hasError || !summary) {
    return [
      {
        label: 'API',
        value: 'Unavailable',
        helper: 'The admin dashboard summary request could not be completed.',
        status: 'unavailable'
      },
      {
        label: 'Database',
        value: 'Unavailable',
        helper: 'Database count status is unknown because the summary request failed.',
        status: 'unavailable'
      },
      {
        label: 'SBERT',
        value: 'Unknown',
        helper: 'SBERT health is not checked by this dashboard endpoint yet.',
        status: 'unknown'
      }
    ];
  }

  const health = summary.serviceHealth || {};

  return [
    {
      label: 'API',
      value: getHealthStyle(health.api?.status).value,
      helper: health.api?.message || 'API process responded to the summary request.',
      status: health.api?.status || 'unknown'
    },
    {
      label: 'Database',
      value: getHealthStyle(health.database?.status).value,
      helper: health.database?.message || 'Database count coverage is unknown.',
      status: health.database?.status || 'unknown'
    },
    {
      label: 'SBERT',
      value: getHealthStyle(health.sbert?.status).value,
      helper: health.sbert?.message || 'SBERT health is not checked by this dashboard endpoint yet.',
      status: health.sbert?.status || 'unknown'
    }
  ];
}

function buildMetricItems({ summary, isLoading, hasError }) {
  if (isLoading) {
    return [
      ['Users', 'Reading user counts from existing tables.', 'users'],
      ['Topics', 'Reading lifecycle topic counts from existing tables.', 'topics'],
      ['Pending Reviews', 'Reading submission status counts from existing tables.', 'submissions'],
      ['Similarity Checks', 'Reading stored snapshot counts from existing tables.', 'similarityChecks']
    ].map(([label, helper, key]) => ({
      label,
      value: 'Loading...',
      helper,
      accent: metricAccents[key]
    }));
  }

  if (hasError || !summary) {
    return [
      {
        label: 'Users',
        value: 'Unavailable',
        helper: 'User counts could not be loaded from the dashboard summary API.',
        accent: metricAccents.users
      },
      {
        label: 'Topics',
        value: 'Unavailable',
        helper: 'Topic repository totals could not be loaded from the dashboard summary API.',
        accent: metricAccents.topics
      },
      {
        label: 'Pending Reviews',
        value: 'Unavailable',
        helper: 'Submission status counts could not be loaded from the dashboard summary API.',
        accent: metricAccents.submissions
      },
      {
        label: 'Similarity Checks',
        value: 'Unavailable',
        helper: 'Similarity snapshot counts could not be loaded from the dashboard summary API.',
        accent: metricAccents.similarityChecks
      }
    ];
  }

  const { users, submissions, topics, similarityChecks } = summary;

  return [
    {
      label: 'Users',
      value: formatCount(users?.total),
      helper: users?.status === 'available'
        ? `${formatCountWithLabel(users.students, 'student')}, ${formatCountWithLabel(users.lecturers, 'lecturer')}, ${formatCountWithLabel(users.admins, 'admin')}. ${formatCount(users.active)} active, ${formatCount(users.suspended)} suspended.`
        : 'User counts are unavailable from the read-only dashboard summary.',
      accent: metricAccents.users
    },
    {
      label: 'Topics',
      value: formatCount(topics?.total),
      helper: topics?.status === 'available'
        ? `${formatCount(topics.historical)} historical, ${formatCount(topics.currentSession)} current-session, ${formatCount(topics.underReview)} under-review topics.`
        : 'Topic lifecycle counts are unavailable from the read-only dashboard summary.',
      accent: metricAccents.topics
    },
    {
      label: 'Pending Reviews',
      value: formatCount(submissions?.pendingReview),
      helper: submissions?.status === 'available'
        ? `${formatCount(submissions.total)} total submissions: ${formatCount(submissions.awaitingRevision)} awaiting revision, ${formatCount(submissions.approved)} approved, ${formatCount(submissions.rejected)} rejected.`
        : 'Submission status counts are unavailable from the read-only dashboard summary.',
      accent: metricAccents.submissions
    },
    {
      label: 'Similarity Checks',
      value: formatCount(similarityChecks?.snapshots),
      helper: similarityChecks?.status === 'available'
        ? `${formatCount(similarityChecks.highRisk)} high-risk, ${formatCount(similarityChecks.mediumRisk)} medium-risk, ${formatCount(similarityChecks.lowRisk)} low-risk stored snapshots.`
        : 'Stored similarity snapshot counts are unavailable from the read-only dashboard summary.',
      accent: metricAccents.similarityChecks
    }
  ];
}

function ServiceHealthCard({ item }) {
  const style = getHealthStyle(item.status);

  return (
    <article className={`rounded-[1.1rem] border border-border-subtle border-l-4 ${style.border} bg-white p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{item.label}</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">{item.value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${style.badge}`}>
          {style.statusLabel}
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
      <p className="mt-2 text-xl font-semibold text-text-primary">{item.value}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{item.helper}</p>
    </article>
  );
}

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setLoadState('loading');
      try {
        const result = await getAdminDashboardSummary();
        if (!isMounted) {
          return;
        }
        setSummary(result.data || null);
        setMeta(result.meta || null);
        setLoadState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSummary(null);
        setMeta(null);
        setLoadState('error');
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const isLoading = loadState === 'loading';
  const hasError = loadState === 'error';
  const serviceHealthItems = useMemo(
    () => buildServiceHealthItems({ summary, isLoading, hasError }),
    [summary, isLoading, hasError]
  );
  const metricItems = useMemo(
    () => buildMetricItems({ summary, isLoading, hasError }),
    [summary, isLoading, hasError]
  );
  const databaseStatus = isLoading
    ? 'loading'
    : summary?.serviceHealth?.database?.status || (hasError ? 'unavailable' : 'unknown');
  const feedLabel = isLoading
    ? 'Loading summary...'
    : hasError
      ? 'Summary unavailable'
      : 'Read-only counts connected';
  const feedDescription = isLoading
    ? 'The dashboard is reading existing table counts without performing any mutation.'
    : hasError
      ? 'The summary endpoint could not be reached. No fallback metrics are invented.'
      : meta?.dataCoverage || 'Read-only counts from existing tables.';

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
                    System oversight console for real read-only counts, service coverage, and honest unavailable states.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                      Current feed
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">{feedLabel}</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-950">
                    <span>Database status: {getHealthStyle(databaseStatus).statusLabel}</span>
                    <StatusBadge status={buildStatusBadgeStatus(databaseStatus)} />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-50/75">
                  {feedDescription}
                </p>
                {meta?.generatedAt ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-100/80">
                    Generated at {meta.generatedAt}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div className="rounded-[1.4rem] border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-800">
              <p className="font-semibold text-blue-900">Admin metrics use a read-only summary endpoint</p>
              <p>
                This dashboard reads safe counts from existing tables. It does not create reports, expose exports, mutate records, or present placeholder metrics as real.
              </p>
            </div>

            {hasError ? (
              <InfoCallout
                variant="warning"
                title="Admin dashboard summary unavailable"
                message="The read-only dashboard endpoint could not be reached. The page keeps unavailable states visible and does not substitute fake data."
              />
            ) : null}

            {summary?.warnings?.length ? (
              <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                <p className="font-semibold">Partial dashboard coverage</p>
                <ul className="mt-2 space-y-1">
                  {summary.warnings.map((warning) => (
                    <li key={`${warning.section}-${warning.code}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <section className="rounded-[1.5rem] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Service health</h2>
                  <p className="text-sm leading-6 text-text-secondary">
                    API and database status come from the read-only summary request; SBERT remains honestly unknown.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
                  Read-only status
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
                Counts are derived from existing users, submissions, topic lifecycle tables, and saved similarity snapshots.
              </p>
            </div>
            <span className="inline-flex w-fit shrink-0 rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              No fake values
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
                Activity remains empty on this dashboard until a scoped admin audit UI connects to real audit records.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Not displayed here
            </span>
          </div>
          <div className="pt-4">
            <EmptyStatePanel
              className="min-h-52"
              title="Recent activity is not displayed on this dashboard yet"
              message="Audit events, report generation, user-management changes, and system activity are not summarized here until a separate activity surface is approved."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">ADMIN-01 state references</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Normal, degraded, and critical visual states are represented carefully; only returned backend states are treated as live.
          </p>
          <ul className="mt-4 grid gap-3">
            {plannedStates.map((state) => (
              <li key={state.label} className={`rounded-[1rem] border p-4 text-sm ${state.tone}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{state.label}</span>
                  <span className="inline-flex w-fit shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-xs font-semibold">
                    Reference only
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
            Admin operations stay explicit about what is not connected in this PR.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {deferredWorkflowItems.map((item) => (
              <div key={item.label} className="rounded-[1rem] border border-dashed border-emerald-900/20 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-950">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{item.helper}</p>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-muted">
                  Deferred
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <InfoCallout
              variant="warning"
              title="Deferred admin workflows"
              message="User mutations, report exports, audit-log UI, settings changes, import controls, SBERT health probing, and analytics remain out of scope for this dashboard PR."
            />
          </div>
        </div>
      </section>
    </AdminDashboardLayout>
  );
}

export default DashboardPage;
