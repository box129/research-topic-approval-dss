import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import { listAdminSettings } from '../../api/admin';

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

function formatUpdater(updatedBy) {
  if (!updatedBy) {
    return 'Not recorded';
  }

  return updatedBy.name || updatedBy.email || `User ${updatedBy.id}`;
}

function maskLongValue(value) {
  if (!value) {
    return 'Empty value';
  }

  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

function SettingRow({ setting }) {
  return (
    <article className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.1fr_0.8fr] lg:items-start">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            Read-only setting
          </span>
          <h2 className="mt-3 break-all text-base font-semibold leading-6 text-text-primary">{setting.key}</h2>
          <p className="mt-1 text-xs text-text-muted">Stored key from SystemSetting table.</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Value</p>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-[1rem] border border-border-subtle bg-surface-muted px-3 py-2 text-sm leading-6 text-text-secondary">
            {maskLongValue(setting.value)}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Last update</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(setting.updatedAt)}</p>
          <p className="mt-2 text-xs text-text-muted">Updated by {formatUpdater(setting.updatedBy)}</p>
        </div>
      </div>
    </article>
  );
}

function SystemSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [meta, setMeta] = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setPageState('loading');
      setErrorMessage('');
      try {
        const result = await listAdminSettings();
        if (!isMounted) {
          return;
        }
        setSettings(result.data?.items || []);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSettings([]);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'System settings could not be loaded.');
        setPageState('error');
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updaterCount = useMemo(() => {
    return settings.filter((setting) => setting.updatedBy).length;
  }, [settings]);

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Configuration governance"
        title="System Settings"
        subtitle="Read-only settings view connected to existing SystemSetting records. Updates remain deferred until each key has approved validation, audit expectations, and safe behavior."
      />

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)]">
        <div className="grid gap-0 xl:grid-cols-[0.76fr_1.24fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Read-only settings data
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Admin settings console</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">Configuration registry</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">
                    Inspect stored settings without exposing unvalidated controls that could alter similarity, auth, email, or feature behavior.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">Mutation boundary</p>
                <p className="mt-1 text-xl font-semibold text-white">No setting writes yet</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                  Save buttons, threshold sliders, feature toggles, and email controls stay unavailable until strict contracts exist.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-emerald-600 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Stored settings</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(settings.length)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Real records returned by the settings endpoint.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-amber-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">With updater</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(updaterCount)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Only shown when stored relation data exists.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-slate-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Write status</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">Deferred</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">No PATCH or save workflow is connected.</p>
              </article>
            </div>

            <InfoCallout
              message={meta?.mutationStatus || 'Settings updates remain deferred until key-specific validation is approved.'}
              title="Settings updates remain deferred"
              variant="warning"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="border-b border-border-subtle pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Stored configuration values</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            Values are displayed exactly from the read-only endpoint. No fake settings, sliders, save controls, or unapproved threshold changes are introduced.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {errorMessage ? (
            <InfoCallout message={errorMessage} title="System settings notice" variant="warning" />
          ) : null}

          {hasError ? (
            <InfoCallout
              message="The settings endpoint could not be reached. No fallback configuration rows are displayed."
              title="System settings unavailable"
              variant="warning"
            />
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-[1.15rem] border border-border-subtle bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasError && settings.length === 0 ? (
            <EmptyStatePanel
              message="The settings endpoint returned an empty list. No placeholder configuration values are shown."
              title="No system settings returned"
            />
          ) : null}

          {!isLoading && !hasError && settings.length > 0 ? (
            <div className="space-y-3">
              {settings.map((setting) => (
                <SettingRow key={setting.key} setting={setting} />
              ))}
            </div>
          ) : null}
        </div>

        {meta?.generatedAt ? (
          <div className="mt-5 rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary">
            Generated {formatDate(meta.generatedAt)}. {meta.dataCoverage || 'Read-only settings from SystemSetting table.'}
          </div>
        ) : null}
      </section>
    </AdminDashboardLayout>
  );
}

export default SystemSettingsPage;
