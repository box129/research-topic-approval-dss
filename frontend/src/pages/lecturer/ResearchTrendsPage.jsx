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

function formatDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function SummaryCard({ helper, label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-emerald-100 bg-white',
    success: 'border-emerald-100 bg-[#f5fbf2]',
    warning: 'border-amber-200 bg-[#fffaf0]'
  };

  return (
    <article className={`rounded-[1.2rem] border p-4 shadow-sm ${tones[tone] || tones.neutral}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1B5E20]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{helper}</p>
    </article>
  );
}

function DistributionList({ emptyMessage, items, labelKey, title }) {
  return (
    <article className="rounded-[1.35rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1B5E20]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-border-subtle">
          {items.map((item) => (
            <div key={`${item[labelKey]}-${item.count}`} className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm font-medium text-text-primary">{item[labelKey]}</span>
              <span className="rounded-full bg-[#f1f8ed] px-3 py-1 text-sm font-semibold text-[#1B5E20]">
                {formatNumber(item.count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusGrid({ items, title }) {
  return (
    <article className="rounded-[1.35rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1B5E20]">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-[1rem] border border-border-subtle bg-[#fbfdf8] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{formatNumber(item.value)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ResearchTrendsPage() {
  const [trends, setTrends] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrends = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await getLecturerResearchTrends();
      setTrends(result.data || null);
      setMeta(result.meta || null);
    } catch (err) {
      setTrends(null);
      setMeta(null);
      setError(err.response?.data?.message || 'Unable to load lecturer research trends.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const hasAggregateData = useMemo(() => {
    if (!trends) {
      return false;
    }

    return (
      formatNumber(trends.topics?.total) > 0 ||
      formatNumber(trends.submissions?.total) > 0 ||
      formatNumber(trends.similarityChecks?.snapshots) > 0
    );
  }, [trends]);

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
        subtitle="Read-only aggregate trends connected to existing topics, submissions, and stored similarity snapshots."
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
        <ErrorState
          title="Research trends unavailable"
          message={`${error} No fallback charts, insights, or recommendations are displayed.`}
          onRetry={loadTrends}
        />
      )}

      {!isLoading && !error && trends && (
        <>
          <section className="overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-[0_22px_70px_-42px_rgb(4_120_87_/_0.55)]">
            <div className="border-l-4 border-l-brand-gold bg-[linear-gradient(145deg,#f4fbef,#fffdf7)] p-5 sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">
                    Real aggregate data
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#1B5E20]">
                    Research trend counts, not generated insights
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
                    These totals are read from existing records only. The page does not invent trend charts,
                    fake keywords, recommendations, or semantic research insights.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1B5E20] shadow-sm">
                  Read-only aggregates
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SummaryCard
                  helper="Lifecycle topic rows from existing topic tables"
                  label="Topic records"
                  value={formatNumber(trends.topics?.total)}
                  tone={formatNumber(trends.topics?.total) > 0 ? 'success' : 'warning'}
                />
                <SummaryCard
                  helper="Submission rows grouped by stored status"
                  label="Submissions"
                  value={formatNumber(trends.submissions?.total)}
                  tone={formatNumber(trends.submissions?.total) > 0 ? 'success' : 'warning'}
                />
                <SummaryCard
                  helper="Stored lecturer similarity snapshots only"
                  label="Similarity snapshots"
                  value={formatNumber(trends.similarityChecks?.snapshots)}
                  tone={formatNumber(trends.similarityChecks?.snapshots) > 0 ? 'success' : 'warning'}
                />
              </div>
            </div>
          </section>

          <InfoCallout
            title="No fake analytics"
            message={`${meta?.dataCoverage || 'Read-only aggregate data from existing records.'} Keyword clustering and recommendations remain deferred, so no fake keywords, fake charts, or generated research insights are shown.`}
          />

          {!hasAggregateData ? (
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-card sm:p-7">
              <EmptyStatePanel
                title="Not enough trend data yet"
                message="The trends endpoint returned zero aggregate counts. No placeholder charts, fake keywords, fake recommendations, or invented research insights are displayed."
                action={(
                  <SecondaryButton type="button" onClick={loadTrends}>
                    Refresh Trends
                  </SecondaryButton>
                )}
              />
            </section>
          ) : (
            <section className="grid gap-5 xl:grid-cols-2">
              <DistributionList
                emptyMessage="No topic categories were returned by the endpoint."
                items={topicCategories}
                labelKey="category"
                title="Topic distribution by category"
              />
              <DistributionList
                emptyMessage="No topic session-year groups were returned by the endpoint."
                items={topicSessions}
                labelKey="sessionYear"
                title="Topic distribution by session"
              />
              <DistributionList
                emptyMessage="No submission categories were returned by the endpoint."
                items={submissionCategories}
                labelKey="category"
                title="Submission distribution by category"
              />
              <StatusGrid
                title="Submission status distribution"
                items={[
                  { label: 'Pending review', value: submissionStatus.pendingReview },
                  { label: 'Awaiting revision', value: submissionStatus.awaitingRevision },
                  { label: 'Approved', value: submissionStatus.approved },
                  { label: 'Rejected', value: submissionStatus.rejected }
                ]}
              />
              <StatusGrid
                title="Stored similarity risk counts"
                items={[
                  { label: 'High risk', value: similarityRisk.high },
                  { label: 'Medium risk', value: similarityRisk.medium },
                  { label: 'Low risk', value: similarityRisk.low },
                  { label: 'Unknown risk', value: similarityRisk.unknown }
                ]}
              />
              <StatusGrid
                title="Similarity response status"
                items={[
                  { label: 'Success', value: responseStatus.success },
                  { label: 'Partial success', value: responseStatus.partialSuccess },
                  { label: 'Error', value: responseStatus.error },
                  { label: 'Other', value: responseStatus.other }
                ]}
              />
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <InfoCallout
              title="Keyword trends deferred"
              message={trends.keywordTrends?.message || 'Keyword trend extraction is deferred. No fake keyword clusters are displayed.'}
              variant="warning"
            />
            <InfoCallout
              title="Recommendations deferred"
              message={trends.recommendations?.message || 'Research recommendations are deferred. This page returns aggregate counts only.'}
              variant="warning"
            />
          </section>

          <section className="rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-text-secondary shadow-sm">
            <p>
              Generated at {formatDate(meta?.generatedAt)}. Source tables:{' '}
              {(meta?.sourceTables || []).join(', ') || 'Not reported'}.
            </p>
            <p className="mt-2">
              No lecturer mutation, export, threshold change, similarity recalculation, or generated analytics workflow is connected here.
            </p>
          </section>
        </>
      )}
    </LecturerDashboardLayout>
  );
}

export default ResearchTrendsPage;
