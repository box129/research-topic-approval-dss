import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import { exportAdminReport, getAdminReportsSummary } from '../../api/admin';

const EXPORT_TYPES = [
  {
    type: 'users',
    label: 'Users CSV',
    description: 'Account names, roles and statuses.'
  },
  {
    type: 'submissions',
    label: 'Submissions CSV',
    description: 'Submission workflow records.'
  },
  {
    type: 'topics',
    label: 'Topics CSV',
    description: 'Topic lifecycle records.'
  },
  {
    type: 'similarity-snapshots',
    label: 'Similarity snapshots CSV',
    description: 'Stored similarity snapshot summaries.'
  },
  {
    type: 'audit-logs',
    label: 'Audit logs CSV',
    description: 'Stored audit event summaries.'
  },
  {
    type: 'supervisee-assignments',
    label: 'Supervisee assignments CSV',
    description: 'Lecturer-supervisee assignment records.'
  }
];

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

function formatDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function SummaryCard({ accent = 'border-l-emerald-600', helper, label, value }) {
  return (
    <article className={`rounded-lg border border-border-subtle border-l-[3px] ${accent} bg-white p-3`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{helper}</p>
    </article>
  );
}

function CountPill({ label, value }) {
  return (
    <span className="inline-flex rounded-full border border-border-subtle bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
      {label}: {formatCount(value)}
    </span>
  );
}

function SectionCard({ children, title, subtitle }) {
  return (
    <article className="rounded-[10px] border border-border-subtle bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm leading-6 text-text-secondary">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </article>
  );
}

function triggerCsvDownload({ blob, filename }) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function ExportActionsSection({ exportState, onExport }) {
  return (
    <SectionCard
      subtitle="Download available report data as CSV. Each export is recorded in the audit log."
      title="CSV exports"
    >
      <div className="grid gap-3">
        {EXPORT_TYPES.map((exportType) => (
          <div
            className="rounded-lg border border-border-subtle bg-surface-muted p-3"
            key={exportType.type}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">{exportType.label}</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{exportType.description}</p>
              </div>
              <button
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={Boolean(exportState.loadingType)}
                onClick={() => onExport(exportType.type)}
                type="button"
              >
                {exportState.loadingType === exportType.type ? 'Preparing CSV...' : `Download ${exportType.label}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {exportState.success ? (
        <div className="mt-3">
          <InfoCallout message={exportState.success} title="Export started" variant="success" />
        </div>
      ) : null}

      {exportState.error ? (
        <div className="mt-3">
        <InfoCallout role="alert" message={exportState.error} title="Export failed" variant="warning" />
        </div>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-text-secondary">CSV exports are available for the report categories above.</p>
    </SectionCard>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [exportState, setExportState] = useState({
    error: '',
    loadingType: '',
    success: ''
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReportsSummary() {
      setPageState('loading');
      setErrorMessage('');
      try {
        const result = await getAdminReportsSummary();
        if (!isMounted) {
          return;
        }
        setSummary(result.data || null);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSummary(null);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'Reports summary could not be loaded.');
        setPageState('error');
      }
    }

    loadReportsSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';
  const totalSignal = useMemo(() => {
    if (!summary) {
      return 0;
    }

    return [
      summary.users?.total,
      summary.submissions?.total,
      summary.topics?.total,
      summary.similarityChecks?.snapshots,
      summary.auditLogs?.total
    ].reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  }, [summary]);
  const hasReportData = totalSignal > 0;

  async function handleExport(type) {
    setExportState({
      error: '',
      loadingType: type,
      success: ''
    });

    try {
      const result = await exportAdminReport(type);
      triggerCsvDownload(result);
      setExportState({
        error: '',
        loadingType: '',
        success: `${result.filename} download started.`
      });
    } catch (error) {
      setExportState({
        error: error?.response?.data?.error?.message || 'Report export could not be generated.',
        loadingType: '',
        success: ''
      });
    }
  }

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Governance reporting"
        title="Reports"
        subtitle="Review administrative summaries and download supported CSV reports."
      />

      <div aria-live="polite" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                accent="border-l-emerald-600"
                helper="User records"
                label="Users"
                value={isLoading ? 'Loading...' : formatCount(summary?.users?.total)}
              />
              <SummaryCard
                accent="border-l-blue-500"
                helper="Student submissions"
                label="Submissions"
                value={isLoading ? 'Loading...' : formatCount(summary?.submissions?.total)}
              />
              <SummaryCard
                accent="border-l-amber-500"
                helper="Repository records"
                label="Topics"
                value={isLoading ? 'Loading...' : formatCount(summary?.topics?.total)}
              />
              <SummaryCard
                accent="border-l-rose-500"
                helper="Recorded events"
                label="Audit events"
                value={isLoading ? 'Loading...' : formatCount(summary?.auditLogs?.total)}
              />
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="border-b border-border-subtle pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Report summary sections</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            Administrative totals and distributions from the current system records.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {errorMessage ? (
        <InfoCallout role={hasError ? 'alert' : undefined} message={errorMessage} title={hasError ? 'Reports summary unavailable' : 'Reports notice'} variant="warning" />
          ) : null}

          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-36 animate-pulse rounded-[10px] border border-border-subtle bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasError && !hasReportData ? (
            <>
              <EmptyStatePanel
                message="There is not yet enough activity to populate the report summary. CSV exports remain available."
                title="Not enough report data yet"
              />
              <ExportActionsSection
                exportState={exportState}
                onExport={handleExport}
              />
            </>
          ) : null}

          {!isLoading && !hasError && summary && hasReportData ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                subtitle="Role and status counts from existing user records."
                title="User coverage"
              >
                <div className="flex flex-wrap gap-2">
                  <CountPill label="Students" value={summary.users?.byRole?.students} />
                  <CountPill label="Lecturers" value={summary.users?.byRole?.lecturers} />
                  <CountPill label="Admins" value={summary.users?.byRole?.admins} />
                  <CountPill label="Active" value={summary.users?.byStatus?.active} />
                  <CountPill label="Suspended" value={summary.users?.byStatus?.suspended} />
                </div>
              </SectionCard>

              <SectionCard
                subtitle="Approval workflow counts from existing submissions."
                title="Submission decisions"
              >
                <div className="flex flex-wrap gap-2">
                  <CountPill label="Pending" value={summary.submissions?.byStatus?.pendingReview} />
                  <CountPill label="Awaiting revision" value={summary.submissions?.byStatus?.awaitingRevision} />
                  <CountPill label="Approved" value={summary.submissions?.byStatus?.approved} />
                  <CountPill label="Rejected" value={summary.submissions?.byStatus?.rejected} />
                  <CountPill label="Decided" value={summary.submissions?.decisionCoverage?.decided} />
                </div>
              </SectionCard>

              <SectionCard
                subtitle="Lifecycle counts from topic repository tables."
                title="Topic repository"
              >
                <div className="flex flex-wrap gap-2">
                  <CountPill label="Historical" value={summary.topics?.byLifecycle?.historical} />
                  <CountPill label="Current session" value={summary.topics?.byLifecycle?.currentSession} />
                  <CountPill label="Under review" value={summary.topics?.byLifecycle?.underReview} />
                </div>
              </SectionCard>

              <SectionCard
                subtitle="Stored lecturer snapshot counts only."
                title="Similarity snapshots"
              >
                <div className="flex flex-wrap gap-2">
                  <CountPill label="High risk" value={summary.similarityChecks?.byRisk?.high} />
                  <CountPill label="Medium risk" value={summary.similarityChecks?.byRisk?.medium} />
                  <CountPill label="Low risk" value={summary.similarityChecks?.byRisk?.low} />
                  <CountPill label="Unknown risk" value={summary.similarityChecks?.byRisk?.unknown} />
                </div>
              </SectionCard>

              <SectionCard
                subtitle="Stored audit event counts only."
                title="Audit events"
              >
                <div className="flex flex-wrap gap-2">
                  <CountPill label="Admin actor" value={summary.auditLogs?.byActorRole?.admin} />
                  <CountPill label="Lecturer actor" value={summary.auditLogs?.byActorRole?.lecturer} />
                  <CountPill label="Student actor" value={summary.auditLogs?.byActorRole?.student} />
                  <CountPill label="Unknown actor" value={summary.auditLogs?.byActorRole?.unknown} />
                </div>

                {summary.auditLogs?.topEventTypes?.length ? (
                  <div className="mt-4 space-y-2">
                    {summary.auditLogs.topEventTypes.map((event) => (
                      <div key={event.eventType} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-muted px-3 py-2 text-sm">
                        <span className="font-semibold text-text-primary">{event.eventType}</span>
                        <span className="text-text-secondary">{formatCount(event.count)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No audit event distribution returned.</p>
                )}
              </SectionCard>

              <ExportActionsSection
                exportState={exportState}
                onExport={handleExport}
              />
            </div>
          ) : null}
        </div>

        {meta?.generatedAt ? (
          <div className="mt-5 rounded-lg border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary">
            Generated {formatDate(meta.generatedAt)}.
          </div>
        ) : null}
      </section>
    </AdminDashboardLayout>
  );
}

export default ReportsPage;
