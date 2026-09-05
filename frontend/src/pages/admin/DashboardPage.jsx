import { useEffect, useMemo, useState } from 'react';
import { getAdminDashboardSummary } from '../../api/admin';
import InfoCallout from '../../components/ui/InfoCallout';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';

const healthStyles = {
  available: 'border-l-feedback-success',
  unavailable: 'border-l-feedback-danger',
  unknown: 'border-l-feedback-info',
  loading: 'border-l-feedback-info'
};
const formatCount = (value) => Number.isFinite(value) ? value.toLocaleString() : 'Unavailable';
const serviceDefinitions = [
  { key: 'api', label: 'API' },
  { key: 'database', label: 'Database' },
  { key: 'semanticProvider', label: 'Voyage semantic provider' }
];

function serviceItems(summary, state) {
  if (state === 'loading') return serviceDefinitions.map(({ label }) => ({ label, status: 'loading', value: 'Loading' }));
  if (state === 'error' || !summary) return serviceDefinitions.map(({ label, key }) => ({ label, status: key === 'semanticProvider' ? 'unknown' : 'unavailable', value: key === 'semanticProvider' ? 'Unknown' : 'Unavailable' }));
  return serviceDefinitions.map(({ key, label }) => {
    const health = summary.serviceHealth?.[key];
    return {
      label,
      status: health?.status || 'unknown',
      value: health?.status === 'available' ? 'Available' : health?.status === 'unavailable' ? 'Unavailable' : 'Unknown',
      helper: health?.message
    };
  });
}

function metricItems(summary, state) {
  if (state !== 'success' || !summary) return ['Users', 'Topics', 'Pending Reviews', 'Similarity Checks'].map((label) => ({ label, value: state === 'loading' ? 'Loading' : 'Unavailable' }));
  return [
    { label: 'Users', value: formatCount(summary.users?.total), helper: summary.users?.status === 'available' ? `${formatCount(summary.users.students)} students, ${formatCount(summary.users.lecturers)} lecturers, ${formatCount(summary.users.admins)} admin. ${formatCount(summary.users.active)} active, ${formatCount(summary.users.suspended)} suspended.` : 'User counts are unavailable from the read-only dashboard summary.' },
    { label: 'Topics', value: formatCount(summary.topics?.total), helper: summary.topics?.status === 'available' ? `${formatCount(summary.topics.historical)} historical, ${formatCount(summary.topics.currentSession)} current-session, ${formatCount(summary.topics.underReview)} under-review topics.` : 'Topic lifecycle counts are unavailable from the read-only dashboard summary.' },
    { label: 'Pending Reviews', value: formatCount(summary.submissions?.pendingReview), helper: summary.submissions?.status === 'available' ? `${formatCount(summary.submissions.total)} total submissions: ${formatCount(summary.submissions.awaitingRevision)} revision requested, ${formatCount(summary.submissions.approved)} approved, ${formatCount(summary.submissions.rejected)} rejected.` : 'Submission status counts are unavailable from the read-only dashboard summary.' },
    { label: 'Similarity Checks', value: formatCount(summary.similarityChecks?.snapshots), helper: summary.similarityChecks?.status === 'available' ? `${formatCount(summary.similarityChecks.highRisk)} high-risk, ${formatCount(summary.similarityChecks.mediumRisk)} medium-risk, ${formatCount(summary.similarityChecks.lowRisk)} low-risk stored snapshots.` : 'Stored similarity snapshot counts are unavailable from the read-only dashboard summary.' }
  ];
}

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  useEffect(() => { let mounted = true; getAdminDashboardSummary().then((result) => { if (mounted) { setSummary(result.data || null); setLoadState('success'); } }).catch(() => { if (mounted) setLoadState('error'); }); return () => { mounted = false; }; }, []);
  const services = useMemo(() => serviceItems(summary, loadState), [summary, loadState]);
  const metrics = useMemo(() => metricItems(summary, loadState), [summary, loadState]);

  return <AdminDashboardLayout>
    <header><h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1><p className="mt-1 text-sm text-text-secondary">Monitor service status and key administrative metrics.</p></header>
      {loadState === 'error' && <InfoCallout role="alert" variant="warning" title="Summary unavailable" message="Administrative metrics could not be loaded." />}
    {summary?.warnings?.length ? <InfoCallout variant="warning" title="Partial dashboard coverage"><ul className="space-y-1">{summary.warnings.map((warning) => <li key={`${warning.section}-${warning.code}`}>{warning.message}</li>)}</ul></InfoCallout> : null}
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card"><h2 className="text-base font-bold text-brand-green-dark">Service health</h2><div className="mt-3 grid gap-3"><>{services.map((item) => <article key={item.label} className={`rounded-lg border border-border-subtle border-l-2 ${healthStyles[item.status] || healthStyles.unknown} p-3`}><p className="text-xs font-bold uppercase text-text-muted">{item.label}</p><p className="mt-1 font-semibold">{item.value}</p>{item.helper && <p className="mt-1 text-sm text-text-secondary">{item.helper}</p>}</article>)}</></div></section>
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card"><h2 className="text-base font-bold text-brand-green-dark">System metrics</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((item) => <article key={item.label} className="rounded-lg border border-border-subtle border-l-2 border-l-brand-green p-3"><p className="text-xs font-bold uppercase text-text-muted">{item.label}</p><p className="mt-1 text-xl font-bold">{item.value}</p>{item.helper && <p className="mt-1 text-sm leading-5 text-text-secondary">{item.helper}</p>}</article>)}</div></section>
  </AdminDashboardLayout>;
}

export default DashboardPage;
