import { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import {
  getAdminAuditLogDetail,
  listAdminAuditLogs,
  previewAdminAuditLogPurge,
  purgeAdminAuditLogs
} from '../../api/admin';

const roleOptions = [
  { value: 'all', label: 'All actor roles' },
  { value: 'admin', label: 'Admins' },
  { value: 'lecturer', label: 'Lecturers' },
  { value: 'student', label: 'Students' }
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

function formatActor(actor) {
  if (!actor) {
    return 'Actor not recorded';
  }

  return actor.email || actor.role || (actor.id ? `User ${actor.id}` : 'Actor not recorded');
}

function formatTarget(target) {
  if (!target?.type && !target?.id) {
    return 'Target not recorded';
  }

  return [target.type, target.id].filter(Boolean).join(' #');
}

function buildListParams(filters) {
  return {
    page: filters.page,
    limit: 10,
    ...(filters.actorRole !== 'all' ? { actorRole: filters.actorRole } : {}),
    ...(filters.eventType.trim() ? { eventType: filters.eventType.trim() } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {})
  };
}

function safeMetadataPreview(metadata) {
  if (!metadata) {
    return 'No metadata stored';
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return 'Metadata could not be serialized for display.';
  }
}

function AuditLogRow({ auditLog, isSelected, isLoadingDetail, onSelect }) {
  return (
    <article className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_0.95fr_0.8fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-white">
              {auditLog.event_type || 'Unknown event'}
            </span>
            {auditLog.actor?.role ? (
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {auditLog.actor.role}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">
            {auditLog.event_type || 'Unknown audit event'}
          </h2>
          <p className="mt-1 break-all text-sm leading-5 text-text-secondary">{formatActor(auditLog.actor)}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Target</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatTarget(auditLog.target)}</p>
          <p className="mt-2 text-xs text-text-muted">Request {auditLog.request?.id || 'not recorded'}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Created</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(auditLog.created_at)}</p>
          <p className="mt-2 text-xs text-text-muted">{auditLog.request?.ip_address || 'IP not recorded'}</p>
        </div>

        <button
          className="rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoadingDetail}
          onClick={() => onSelect(auditLog)}
          type="button"
        >
          {isSelected ? 'Refresh detail' : 'View detail'}
        </button>
      </div>
    </article>
  );
}

function AuditDetailPanel({ auditLog, isLoading, errorMessage }) {
  if (!auditLog && !isLoading && !errorMessage) {
    return (
      <InfoCallout
        title="Audit detail"
        message="Select an audit row to load safe detail from the audit-log detail endpoint."
        variant="info"
      />
    );
  }

  if (isLoading) {
    return <div className="h-44 animate-pulse rounded-[1.15rem] border border-border-subtle bg-surface-muted" />;
  }

  if (errorMessage) {
    return (
      <InfoCallout
        title="Audit detail unavailable"
        message={errorMessage}
        variant="warning"
      />
    );
  }

  return (
    <article className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Selected audit event</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{auditLog.event_type}</h2>
          <p className="mt-1 text-sm text-text-secondary">{formatDate(auditLog.created_at)}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Safe detail
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Actor</p>
          <p className="mt-1 break-all text-sm font-semibold text-text-primary">{formatActor(auditLog.actor)}</p>
          <p className="mt-1 text-xs text-text-muted">Role {auditLog.actor?.role || 'not recorded'}</p>
        </div>
        <div className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Target</p>
          <p className="mt-1 break-all text-sm font-semibold text-text-primary">{formatTarget(auditLog.target)}</p>
          <p className="mt-1 text-xs text-text-muted">Request {auditLog.request?.id || 'not recorded'}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Metadata</p>
        <pre className="mt-2 max-h-72 overflow-auto rounded-[1rem] border border-border-subtle bg-surface-muted p-3 text-xs leading-5 text-text-secondary">
          {safeMetadataPreview(auditLog.metadata)}
        </pre>
      </div>
    </article>
  );
}

function AuditRetentionPanel({
  confirmation,
  olderThanDays,
  onConfirmationChange,
  onOlderThanDaysChange,
  onPreview,
  onPurge,
  preview,
  purgeResult,
  state
}) {
  const canPurge = Boolean(preview) && confirmation === 'CONFIRM_AUDIT_PURGE' && state.preview !== 'loading' && state.purge !== 'loading';

  return (
    <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Retention policy</p>
          <h2 className="mt-2 text-lg font-semibold text-text-primary">Audit purge governance</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Default retention is 365 days, purge requests must target logs at least 90 days old, and destructive purge requires preview plus the exact confirmation phrase.
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Audit CSV export already exists through Reports: `GET /api/v1/admin/reports/export/audit-logs`.
          </p>
        </div>

        <div className="rounded-[1.15rem] border border-amber-200 bg-white p-4">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onPreview}>
            <label className="text-sm font-semibold text-text-primary">
              Purge logs older than days
              <input
                className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                min="1"
                name="olderThanDays"
                onChange={onOlderThanDaysChange}
                type="number"
                value={olderThanDays}
              />
            </label>
            <button
              className="self-end rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={state.preview === 'loading' || state.purge === 'loading'}
              type="submit"
            >
              {state.preview === 'loading' ? 'Previewing...' : 'Preview purge'}
            </button>
          </form>

          {state.error ? (
            <div className="mt-3">
              <InfoCallout message={state.error} title="Audit purge notice" variant="warning" />
            </div>
          ) : null}

          {preview ? (
            <div className="mt-4 rounded-[1rem] border border-border-subtle bg-surface-muted p-4">
              <p className="text-sm font-semibold text-text-primary">Preview result</p>
              <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-3">
                <span>Candidate logs: {formatCount(preview.candidateCount)}</span>
                <span>Will delete: {formatCount(preview.willDeleteCount)}</span>
                <span>Cutoff: {formatDate(preview.cutoffDate)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Preview returns counts and grouped summaries only. Raw audit metadata bodies are not displayed.
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="text-sm font-semibold text-text-primary">
              Type CONFIRM_AUDIT_PURGE to purge previewed logs
              <input
                className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100"
                name="confirmation"
                onChange={onConfirmationChange}
                placeholder="CONFIRM_AUDIT_PURGE"
                type="text"
                value={confirmation}
              />
            </label>
            <button
              className="self-end rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canPurge}
              onClick={onPurge}
              type="button"
            >
              {state.purge === 'loading' ? 'Purging...' : 'Purge old audit logs'}
            </button>
          </div>

          {purgeResult ? (
            <div className="mt-3">
              <InfoCallout
                message={`${formatCount(purgeResult.deletedCount)} old audit logs purged. The purge action was audited as ${purgeResult.auditEventType}.`}
                title="Audit purge completed"
                variant="success"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState('idle');
  const [detailError, setDetailError] = useState('');
  const [filters, setFilters] = useState({
    actorRole: 'all',
    eventType: '',
    search: '',
    page: 1
  });
  const [purgeOlderThanDays, setPurgeOlderThanDays] = useState('365');
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [purgePreview, setPurgePreview] = useState(null);
  const [purgeResult, setPurgeResult] = useState(null);
  const [purgeState, setPurgeState] = useState({
    error: '',
    preview: 'idle',
    purge: 'idle'
  });

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      setPageState('loading');
      setErrorMessage('');
      try {
        const result = await listAdminAuditLogs(buildListParams(filters));
        if (!isMounted) {
          return;
        }
        setAuditLogs(result.data?.items || []);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setAuditLogs([]);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'Audit logs could not be loaded.');
        setPageState('error');
      }
    }

    loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      page: 1
    }));
  }

  async function handleSelect(auditLog) {
    setDetailState('loading');
    setDetailError('');
    try {
      const result = await getAdminAuditLogDetail(auditLog.id);
      setDetail(result.data?.audit_log || null);
      setDetailState('success');
    } catch (error) {
      setDetail(null);
      setDetailError(error?.response?.data?.error?.message || 'Audit detail could not be loaded.');
      setDetailState('error');
    }
  }

  async function handlePurgePreview(event) {
    event.preventDefault();
    setPurgeState({ error: '', preview: 'loading', purge: 'idle' });
    setPurgeResult(null);
    try {
      const result = await previewAdminAuditLogPurge({
        olderThanDays: Number(purgeOlderThanDays)
      });
      setPurgePreview(result.data?.purgePreview || null);
      setPurgeState({ error: '', preview: 'success', purge: 'idle' });
    } catch (error) {
      setPurgePreview(null);
      setPurgeState({
        error: error?.response?.data?.error?.message || 'Audit purge preview could not be generated.',
        preview: 'error',
        purge: 'idle'
      });
    }
  }

  async function handlePurge() {
    setPurgeState({ error: '', preview: 'success', purge: 'loading' });
    setPurgeResult(null);
    try {
      const result = await purgeAdminAuditLogs({
        olderThanDays: Number(purgeOlderThanDays),
        confirmation: purgeConfirmation
      });
      setPurgeResult(result.data?.purge || null);
      setPurgePreview(null);
      setPurgeConfirmation('');
      setPurgeState({ error: '', preview: 'idle', purge: 'success' });
      setFilters((current) => ({ ...current }));
    } catch (error) {
      setPurgeState({
        error: error?.response?.data?.error?.message || 'Audit purge could not be completed.',
        preview: purgePreview ? 'success' : 'idle',
        purge: 'error'
      });
    }
  }

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Governance trace"
        title="Audit Log"
        subtitle="Audit visibility connected to stored events, safe CSV export through Reports, and guarded retention/purge controls."
      />

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)]">
        <div className="grid gap-0 xl:grid-cols-[0.76fr_1.24fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Real audit records
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Admin audit console</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">Event trail and safe detail</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">
                    Review stored governance events without inventing activity rows. Purge operations require preview, policy age checks, and an audited confirmation.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">Boundary</p>
                <p className="mt-1 text-xl font-semibold text-white">Governed evidence</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                  CSV export is available from Reports. Purge controls are deliberately constrained and audited.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-emerald-600 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Visible rows</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(auditLogs.length)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Current page from the audit-log endpoint.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-amber-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Total matches</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(meta?.pagination?.total || 0)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Reported by pagination metadata only.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-slate-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Export status</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">CSV</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Audit CSV export is available through admin reports.</p>
              </article>
            </div>

            <InfoCallout
              title="No fake audit activity"
              message="Empty responses stay empty. This page does not fabricate logins, imports, user changes, settings changes, report exports, or system events."
              variant="info"
            />
          </div>
        </div>
      </section>

      <AuditRetentionPanel
        confirmation={purgeConfirmation}
        olderThanDays={purgeOlderThanDays}
        onConfirmationChange={(event) => setPurgeConfirmation(event.target.value)}
        onOlderThanDaysChange={(event) => {
          setPurgeOlderThanDays(event.target.value);
          setPurgePreview(null);
          setPurgeResult(null);
        }}
        onPreview={handlePurgePreview}
        onPurge={handlePurge}
        preview={purgePreview}
        purgeResult={purgeResult}
        state={purgeState}
      />

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Audit events</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                Search and filters call the read-only audit-log endpoint. Detail uses the audit-log detail endpoint.
              </p>
            </div>

            <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_12rem_auto] lg:min-w-[48rem]" onSubmit={handleSubmit}>
              <label className="text-sm font-semibold text-text-primary">
                <span className="sr-only">Search audit logs</span>
                <input
                  className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  name="search"
                  onChange={handleFieldChange}
                  placeholder="Search event, actor, target"
                  type="search"
                  value={filters.search}
                />
              </label>
              <label className="text-sm font-semibold text-text-primary">
                <span className="sr-only">Actor role</span>
                <select
                  className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  name="actorRole"
                  onChange={handleFieldChange}
                  value={filters.actorRole}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-text-primary">
                <span className="sr-only">Event type</span>
                <input
                  className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  name="eventType"
                  onChange={handleFieldChange}
                  placeholder="Event type"
                  type="search"
                  value={filters.eventType}
                />
              </label>
              <button
                className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
                type="submit"
              >
                Apply filters
              </button>
            </form>
          </div>

          <div className="mt-5 space-y-4">
            {errorMessage ? (
              <InfoCallout message={errorMessage} title="Audit log notice" variant="warning" />
            ) : null}

            {hasError ? (
              <InfoCallout
                message="The audit-log endpoint could not be reached. No fallback audit rows are displayed."
                title="Audit logs unavailable"
                variant="warning"
              />
            ) : null}

            {isLoading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-28 animate-pulse rounded-[1.15rem] border border-border-subtle bg-surface-muted" />
                ))}
              </div>
            ) : null}

            {!isLoading && !hasError && auditLogs.length === 0 ? (
              <EmptyStatePanel
                message="The audit-log endpoint returned an empty list for the selected filters. No placeholder audit events are shown."
                title="No audit logs returned"
              />
            ) : null}

            {!isLoading && !hasError && auditLogs.length > 0 ? (
              <div className="space-y-3">
                {auditLogs.map((auditLog) => (
                  <AuditLogRow
                    auditLog={auditLog}
                    isLoadingDetail={detailState === 'loading'}
                    isSelected={detail?.id === auditLog.id}
                    key={auditLog.id}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {meta?.pagination ? (
            <div className="mt-5 flex flex-col gap-2 rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {formatCount(auditLogs.length)} of {formatCount(meta.pagination.total)} matching events.
              </span>
              <span>
                Page {formatCount(meta.pagination.page)} of {formatCount(meta.pagination.totalPages)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
          <div className="border-b border-border-subtle pb-4">
            <h2 className="text-lg font-semibold text-text-primary">Safe detail</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Detail data is loaded only from `GET /api/v1/admin/audit-logs/:id`.
            </p>
          </div>
          <div className="mt-5">
            <AuditDetailPanel
              auditLog={detail}
              errorMessage={detailError}
              isLoading={detailState === 'loading'}
            />
          </div>
        </div>
      </section>
    </AdminDashboardLayout>
  );
}

export default AuditLogPage;
