import { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import { listAdminSettings } from '../../api/admin';

const settingLabels = {
  demo_auth_users_notice: 'Demo authentication users'
};

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatUpdater(updatedBy) {
  if (!updatedBy) return 'Not recorded';
  return updatedBy.name || updatedBy.email || `User ${updatedBy.id}`;
}

function displayValue(value) {
  if (!value) return 'Empty value';
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

function SettingRow({ setting }) {
  return (
    <article className="rounded-[10px] border border-border-subtle bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(12rem,0.65fr)]">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-text-primary">{settingLabels[setting.key] || setting.key}</h2>
          <p className="mt-1 break-all font-mono text-xs text-text-muted">{setting.key}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Value</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{displayValue(setting.value)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Last update</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(setting.updatedAt)}</p>
          <p className="mt-1 text-xs text-text-muted">Updated by {formatUpdater(setting.updatedBy)}</p>
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
        if (!isMounted) return;
        setSettings(result.data?.items || []);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) return;
        setSettings([]);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'System settings could not be loaded.');
        setPageState('error');
      }
    }
    loadSettings();
    return () => { isMounted = false; };
  }, []);

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader eyebrow="Configuration" title="System Settings" subtitle="Review the configuration values currently stored by the system." />

      <InfoCallout title="Read-only settings" message="Configuration values can be reviewed here but cannot be changed." variant="info" />

      <section aria-labelledby="stored-settings-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h2 id="stored-settings-title" className="text-lg font-bold text-text-primary">Stored configuration values</h2>
            <p className="mt-1 text-sm text-text-secondary">{isLoading ? 'Loading settings...' : `${settings.length} setting${settings.length === 1 ? '' : 's'}`}</p>
          </div>
          {meta?.generatedAt ? <p className="text-xs text-text-muted">Updated {formatDate(meta.generatedAt)}</p> : null}
        </div>

      {errorMessage ? <InfoCallout role="alert" message={errorMessage} title="System settings unavailable" variant="warning" /> : null}
        {isLoading ? <div aria-live="polite" className="rounded-[10px] border border-border-subtle bg-white p-6 text-sm text-text-secondary">Loading system settings...</div> : null}
        {!isLoading && !hasError && settings.length === 0 ? <EmptyStatePanel message="No configuration values are available." title="No system settings" /> : null}
        {!isLoading && !hasError && settings.length > 0 ? <div className="space-y-3">{settings.map((setting) => <SettingRow key={setting.key} setting={setting} />)}</div> : null}
      </section>
    </AdminDashboardLayout>
  );
}

export default SystemSettingsPage;
