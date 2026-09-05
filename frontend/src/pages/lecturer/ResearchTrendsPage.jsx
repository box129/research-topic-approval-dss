import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import ErrorState from '../../components/ui/ErrorState';
import InfoCallout from '../../components/ui/InfoCallout';
import LoadingState from '../../components/ui/LoadingState';
import PageHeader from '../../components/ui/PageHeader';
import SecondaryButton from '../../components/ui/SecondaryButton';
import LecturerDashboardLayout from '../../layouts/LecturerDashboardLayout';
import { getLecturerResearchTrends } from '../../api/submissions';

function formatNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function SummaryChip({ label, value }) {
  return (
    <p className="w-fit rounded-full border border-border-subtle bg-white px-3 py-1 text-sm font-semibold text-text-secondary">
      {label} <span className="ml-1 text-text-primary">{value}</span>
    </p>
  );
}

function DistributionList({ emptyMessage, items, labelKey, title }) {
  return (
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-text-primary">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">{emptyMessage}</p>
      ) : (
        <dl className="mt-3 divide-y divide-border-subtle">
          {items.map((item) => (
            <div key={`${item[labelKey]}-${item.count}`} className="flex items-center justify-between gap-4 py-3">
              <dt className="break-words text-sm text-text-primary">{item[labelKey]}</dt>
              <dd className="font-semibold text-brand-green">{formatNumber(item.count)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function StatusList({ items, title }) {
  return (
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-text-primary">{title}</h2>
      <dl className="mt-3 divide-y divide-border-subtle">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-text-primary">{item.label}</dt>
            <dd className="font-semibold text-brand-green">{formatNumber(item.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResearchTrendsPage() {
  const [trends, setTrends] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrends = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await getLecturerResearchTrends();
      setTrends(result.data || null);
    } catch (err) {
      setTrends(null);
      setError(err.response?.data?.message || 'Unable to load lecturer research trends.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const hasAggregateData = useMemo(() => trends && (
    formatNumber(trends.topics?.total) > 0
    || formatNumber(trends.submissions?.total) > 0
    || formatNumber(trends.similarityChecks?.snapshots) > 0
  ), [trends]);

  const topicCategories = trends?.topics?.byCategory || [];
  const topicSessions = trends?.topics?.bySessionYear || [];
  const submissionCategories = trends?.submissions?.byCategory || [];
  const submissionStatus = trends?.submissions?.byStatus || {};
  const similarityRisk = trends?.similarityChecks?.byRisk || {};
  const responseStatus = trends?.similarityChecks?.byResponseStatus || {};

  return (
    <LecturerDashboardLayout>
      <PageHeader
        eyebrow="Lecturer analytics"
        title="Research Trends"
        subtitle="Review aggregate topic, submission, and similarity trends."
        action={(
          <Link
            to="/lecturer/dashboard"
            className="inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Back to Dashboard
          </Link>
        )}
      />

      {isLoading && <LoadingState label="Loading research trends" />}
      {!isLoading && error && (
        <ErrorState title="Research trends unavailable" message={error} onRetry={loadTrends} />
      )}

      {!isLoading && !error && trends && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Research trend summary">
            <SummaryChip label="Topic records" value={formatNumber(trends.topics?.total)} />
            <SummaryChip label="Submissions" value={formatNumber(trends.submissions?.total)} />
            <SummaryChip label="Similarity snapshots" value={formatNumber(trends.similarityChecks?.snapshots)} />
          </div>

          {!hasAggregateData ? (
            <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-card">
              <EmptyStatePanel
                title="Not enough trend data yet"
                message="No aggregate trend information is currently available."
                action={(
                  <SecondaryButton type="button" onClick={loadTrends}>Refresh Trends</SecondaryButton>
                )}
              />
            </section>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <DistributionList
                emptyMessage="No topic category information is available."
                items={topicCategories}
                labelKey="category"
                title="Topic distribution by category"
              />
              <DistributionList
                emptyMessage="No topic session information is available."
                items={topicSessions}
                labelKey="sessionYear"
                title="Topic distribution by session"
              />
              <DistributionList
                emptyMessage="No submission category information is available."
                items={submissionCategories}
                labelKey="category"
                title="Submission distribution by category"
              />
              <StatusList
                title="Submission status distribution"
                items={[
                  { label: 'Pending review', value: submissionStatus.pendingReview },
                  { label: 'Revision requested', value: submissionStatus.awaitingRevision },
                  { label: 'Approved', value: submissionStatus.approved },
                  { label: 'Rejected', value: submissionStatus.rejected }
                ]}
              />
              <StatusList
                title="Stored similarity classification counts"
                items={[
                  { label: 'Higher similarity', value: similarityRisk.high },
                  { label: 'Moderate similarity', value: similarityRisk.medium },
                  { label: 'Lower similarity', value: similarityRisk.low },
                  { label: 'Not classified', value: similarityRisk.unknown }
                ]}
              />
              <StatusList
                title="Similarity response status"
                items={[
                  { label: 'Success', value: responseStatus.success },
                  { label: 'Partial success', value: responseStatus.partialSuccess },
                  { label: 'Error', value: responseStatus.error },
                  { label: 'Other', value: responseStatus.other }
                ]}
              />
            </div>
          )}

          <InfoCallout
            title="Additional analysis"
            message="Keyword trends and research recommendations are not currently available."
            variant="warning"
          />
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default ResearchTrendsPage;
