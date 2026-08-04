import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import {
  commitAdminTopicImport,
  getAdminTopicsSummary,
  listAdminTopics,
  previewAdminTopicImport
} from '../../api/admin';

const lifecycleOptions = [
  { value: 'all', label: 'All lifecycle tables' },
  { value: 'historical', label: 'Historical' },
  { value: 'current-session', label: 'Current session' },
  { value: 'under-review', label: 'Under review' }
];

const lifecycleLabels = {
  historical: 'Historical',
  'current-session': 'Current session',
  'under-review': 'Under review'
};

function formatCount(value) {
  if (typeof value === 'string') {
    return value;
  }

  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

function buildSummaryValue(value, summaryState) {
  if (summaryState === 'loading') {
    return 'Loading...';
  }

  if (summaryState === 'error') {
    return 'Unavailable';
  }

  return value;
}

function formatNullable(value, fallback = 'Not recorded') {
  return value || fallback;
}

function buildListParams(filters) {
  return {
    page: filters.page,
    limit: 10,
    sort: 'updatedAt',
    direction: 'desc',
    ...(filters.lifecycle !== 'all' ? { lifecycle: filters.lifecycle } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {})
  };
}

function SummaryCard({ label, value, helper, accent = 'border-l-emerald-600' }) {
  return (
    <article className={`rounded-[1rem] border border-border-subtle border-l-4 ${accent} bg-white p-4 shadow-sm`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{formatCount(value)}</p>
      <p className="mt-2 text-sm leading-5 text-text-secondary">{helper}</p>
    </article>
  );
}

function getReportValue(report, key) {
  return Number.isFinite(report?.[key]) ? report[key] : 0;
}

function ImportReportGrid({ report, title }) {
  const cards = [
    ['Total rows', 'total_rows'],
    ['Accepted rows', 'accepted_rows'],
    ['Skipped rows', 'skipped_rows'],
    ['Missing titles', 'missing_title_rows'],
    ['Incomplete context', 'incomplete_context_rows'],
    ['Duplicate in batch', 'duplicate_title_rows']
  ];

  return (
    <div className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-text-primary">{title}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, key]) => (
          <div key={key} className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(getReportValue(report, key))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersistenceReportGrid({ report }) {
  const insertedByBucket = report?.inserted_by_bucket || {};
  const cards = [
    ['Attempted records', report?.attempted_records],
    ['Inserted records', report?.inserted_records],
    ['Skipped records', report?.skipped_records],
    ['Failed records', report?.failed_records],
    ['Historical inserted', insertedByBucket.historical],
    ['Current session inserted', insertedByBucket.current_session],
    ['Under review inserted', insertedByBucket.under_review]
  ];

  return (
    <div className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-text-primary">Commit persistence report</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(Number.isFinite(value) ? value : 0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicRow({ topic }) {
  const hasWarnings = topic.dataQuality?.hasImportWarnings;
  const missingContext = !topic.dataQuality?.hasContextFields;

  return (
    <article className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.35fr_0.85fr_0.9fr_0.82fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              {lifecycleLabels[topic.lifecycle] || topic.lifecycle}
            </span>
            {hasWarnings ? (
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Import warnings
              </span>
            ) : null}
            {missingContext ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                Context incomplete
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{topic.title}</h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            {formatNullable(topic.keywords, 'Keywords not recorded')}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Category</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatNullable(topic.category)}</p>
          <p className="mt-2 text-xs text-text-muted">Session {formatNullable(topic.sessionYear)}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Supervisor</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatNullable(topic.supervisorName)}</p>
          <p className="mt-2 text-xs text-text-muted">{formatNullable(topic.sourceType, 'Source not recorded')}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Data quality</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {topic.dataQuality?.hasEmbedding ? 'Embedding stored' : 'Embedding unavailable'}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {topic.dataQuality?.importWarningCount || 0} import warning{topic.dataQuality?.importWarningCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </article>
  );
}

function TopicRepositoryPage() {
  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState('loading');
  const [topics, setTopics] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [listState, setListState] = useState('loading');
  const [filters, setFilters] = useState({
    lifecycle: 'all',
    search: '',
    page: 1
  });
  const [importFile, setImportFile] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [previewState, setPreviewState] = useState('idle');
  const [commitState, setCommitState] = useState('idle');
  const [previewError, setPreviewError] = useState('');
  const [commitError, setCommitError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setSummaryState('loading');
      try {
        const result = await getAdminTopicsSummary();
        if (!isMounted) {
          return;
        }
        setSummary(result.data || null);
        setSummaryState('success');
      } catch {
        if (!isMounted) {
          return;
        }
        setSummary(null);
        setSummaryState('error');
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTopics() {
      setListState('loading');
      try {
        const result = await listAdminTopics(buildListParams(filters));
        if (!isMounted) {
          return;
        }
        setTopics(result.data?.items || []);
        setListMeta(result.meta || null);
        setListState('success');
      } catch {
        if (!isMounted) {
          return;
        }
        setTopics([]);
        setListMeta(null);
        setListState('error');
      }
    }

    loadTopics();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  const totals = summary?.totals || {};
  const dataQuality = summary?.dataQuality || {};
  const topCategories = useMemo(
    () => (summary?.byCategory || []).slice(0, 4),
    [summary]
  );
  const isLoading = listState === 'loading';
  const hasListError = listState === 'error';

  function handleSubmit(event) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      page: 1
    }));
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1
    }));
  }

  function handleImportFileChange(event) {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
    setPreviewResult(null);
    setCommitResult(null);
    setPreviewState('idle');
    setCommitState('idle');
    setPreviewError('');
    setCommitError('');
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setPreviewError('Select an .xlsx file before previewing an import.');
      return;
    }

    setPreviewState('loading');
    setPreviewError('');
    setCommitResult(null);
    setCommitState('idle');
    setCommitError('');

    try {
      const result = await previewAdminTopicImport(importFile);
      setPreviewResult(result.data || null);
      setPreviewState('success');
    } catch (error) {
      setPreviewResult(null);
      setPreviewState('error');
      setPreviewError(error.response?.data?.message || error.message || 'Import preview failed.');
    }
  }

  async function handleCommitImport() {
    if (!importFile || previewState !== 'success') {
      setCommitError('Run a successful preview before committing an import.');
      return;
    }

    setCommitState('loading');
    setCommitError('');

    try {
      const result = await commitAdminTopicImport(importFile);
      setCommitResult(result.data || null);
      setCommitState('success');
    } catch (error) {
      setCommitResult(null);
      setCommitState('error');
      setCommitError(error.response?.data?.message || error.message || 'Import commit failed.');
    }
  }

  const canCommitImport = Boolean(importFile) && previewState === 'success' && commitState !== 'loading';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Repository oversight"
        title="Topic Repository"
        subtitle="Read-only topic repository view with an admin-audited .xlsx import preview and commit workflow. Exports, edits, deletes, migrations, and fabricated topic rows stay unavailable."
      />

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)]">
        <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Read-only repository data
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Admin repository console</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">Lifecycle topic records</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">
                    Browse real imported or stored topic records across historical, current-session, and under-review tables, then use the scoped import panel for audited .xlsx preview and commit.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                  Boundary
                </p>
                <p className="mt-1 text-xl font-semibold text-white">No fake repository rows</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                  Empty responses remain empty. Export, duplicate-existing checks, migration, embedding generation, and edit actions stay deferred.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            {summaryState === 'error' ? (
              <InfoCallout
                variant="warning"
                title="Repository summary unavailable"
                message="Summary counts could not be loaded. The list still avoids fallback metrics or fake category totals."
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="All topics"
                value={buildSummaryValue(totals.all, summaryState)}
                helper={summaryState === 'loading' ? 'Loading lifecycle totals.' : 'Combined count from supported lifecycle tables.'}
                accent="border-l-emerald-600"
              />
              <SummaryCard
                label="Historical"
                value={buildSummaryValue(totals.historical, summaryState)}
                helper="Imported or stored historical topic records."
                accent="border-l-amber-500"
              />
              <SummaryCard
                label="Current session"
                value={buildSummaryValue(totals.currentSession, summaryState)}
                helper="Approved current-session topic records."
                accent="border-l-blue-500"
              />
              <SummaryCard
                label="Under review"
                value={buildSummaryValue(totals.underReview, summaryState)}
                helper="Topic records currently marked under review."
                accent="border-l-rose-500"
              />
            </div>

            <div className="rounded-[1.35rem] border border-border-subtle bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Data coverage</h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Coverage is derived from stored fields only. Missing values are labelled as missing, not replaced.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Real table reads
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">With embeddings</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(buildSummaryValue(dataQuality.withEmbeddings, summaryState))}</p>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Missing context</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(buildSummaryValue(dataQuality.missingContextFields, summaryState))}</p>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Import warnings</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(buildSummaryValue(dataQuality.withImportWarnings, summaryState))}</p>
                </div>
              </div>

              {topCategories.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {topCategories.map((category) => (
                    <span key={`${category.category || 'missing'}-${category.count}`} className="inline-flex rounded-full border border-border-subtle bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                      {category.category || 'Missing category'}: {formatCount(category.count)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Repository records</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Search and lifecycle filters call the read-only admin topic repository endpoint. Import preview and commit are handled separately by the audited import panel below.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] lg:min-w-[42rem]" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-text-primary">
              <span className="sr-only">Search topics</span>
              <input
                className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="search"
                onChange={handleFieldChange}
                placeholder="Search title, keyword, category, supervisor"
                type="search"
                value={filters.search}
              />
            </label>
            <label className="text-sm font-semibold text-text-primary">
              <span className="sr-only">Lifecycle</span>
              <select
                className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="lifecycle"
                onChange={handleFieldChange}
                value={filters.lifecycle}
              >
                {lifecycleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
              type="submit"
            >
              Apply filters
            </button>
          </form>
        </div>

        <div className="mt-5">
          {hasListError ? (
            <InfoCallout
              variant="warning"
              title="Topic records unavailable"
              message="The read-only topic repository endpoint could not be reached. No fallback topic rows are displayed."
            />
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-[1.15rem] border border-border-subtle bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasListError && topics.length === 0 ? (
            <EmptyStatePanel
              title="No topic records returned"
              message="The repository endpoint returned an empty list for the selected filters. No placeholder topics are shown."
            />
          ) : null}

          {!isLoading && !hasListError && topics.length > 0 ? (
            <div className="space-y-3">
              {topics.map((topic) => (
                <TopicRow key={`${topic.lifecycle}-${topic.id}`} topic={topic} />
              ))}
            </div>
          ) : null}
        </div>

        {listMeta?.pagination ? (
          <div className="mt-5 flex flex-col gap-2 rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {formatCount(topics.length)} of {formatCount(listMeta.pagination.total)} matching records.
            </span>
            <span>
              Page {formatCount(listMeta.pagination.page)} of {formatCount(listMeta.pagination.totalPages)}
            </span>
          </div>
        ) : null}
      </section>

      <InfoCallout
        variant="warning"
        title="Import governance remains scoped"
        message="Backend import endpoints are admin-protected and audited. This page now exposes preview and commit only; exports, migrations, duplicate-resolution actions, embedding generation, CSV import, and topic edits remain deferred."
      />

      <section className="rounded-[1.5rem] border border-amber-200 bg-[#fffaf0] p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-amber-200/80 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Admin import workflow</p>
            <h2 className="mt-1 text-xl font-semibold text-text-primary">Preview and commit .xlsx topics</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Select a spreadsheet, preview it through the real admin import endpoint, then commit only after a successful preview.
              Preview and commit are admin-only and audited by the backend.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
            Audited admin operation
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="block text-sm font-semibold text-text-primary">
            <span>Import .xlsx file</span>
            <input
              accept=".xlsx"
              aria-describedby="topic-import-file-help"
              className="mt-2 block w-full rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              data-testid="topic-import-file-input"
              onChange={handleImportFileChange}
              type="file"
            />
          </label>
          <button
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!importFile || previewState === 'loading'}
            onClick={handlePreviewImport}
            type="button"
          >
            {previewState === 'loading' ? 'Previewing...' : 'Preview import'}
          </button>
          <button
            className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!canCommitImport}
            onClick={handleCommitImport}
            type="button"
          >
            {commitState === 'loading' ? 'Committing...' : 'Commit import'}
          </button>
        </div>

        <p id="topic-import-file-help" className="mt-3 text-sm leading-6 text-text-secondary">
          Supported file type: `.xlsx`. The backend returns aggregate import and persistence reports; duplicate-existing checks,
          row-level operator reports, embeddings, similarity integration, CSV import, export/download, edit/delete, and migration workflows remain deferred.
        </p>

        {importFile ? (
          <p className="mt-3 rounded-[1rem] border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-text-primary">
            Selected file: {importFile.name}
          </p>
        ) : null}

        {previewState === 'error' ? (
          <InfoCallout
            variant="warning"
            title="Import preview failed"
            message={`${previewError} No fallback import report or fake preview rows are displayed.`}
          />
        ) : null}

        {previewState === 'success' && previewResult ? (
          <div className="mt-5 space-y-4">
            <InfoCallout
              title="Preview complete"
              message={`Preview parsed ${formatCount(previewResult.records?.length || 0)} accepted normalized record${previewResult.records?.length === 1 ? '' : 's'} from the selected file. This count comes from the backend preview response.`}
            />
            <ImportReportGrid report={previewResult.import_report} title="Preview import report" />
          </div>
        ) : null}

        {commitState === 'error' ? (
          <InfoCallout
            variant="warning"
            title="Import commit failed"
            message={`${commitError} No fallback persistence report or fake commit result is displayed.`}
          />
        ) : null}

        {commitState === 'success' && commitResult ? (
          <div className="mt-5 space-y-4">
            <InfoCallout
              title="Commit complete"
              message="The backend commit endpoint returned a real persistence report for the selected file."
            />
            <ImportReportGrid report={commitResult.import_report} title="Commit import report" />
            <PersistenceReportGrid report={commitResult.persistence_report} />
          </div>
        ) : null}
      </section>
    </AdminDashboardLayout>
  );
}

export default TopicRepositoryPage;
