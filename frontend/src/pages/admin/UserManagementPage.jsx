import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import { useAuth } from '../../auth/useAuth';
import {
  commitAdminUserImport,
  correctAdminUserIdentity,
  createAdminSuperviseeAssignment,
  createAdminUser,
  downloadAdminUserImportTemplate,
  endAdminSuperviseeAssignment,
  inviteAdminUser,
  listAdminSuperviseeAssignments,
  listAdminUsers,
  previewAdminUserImport,
  resetAdminUserCredential,
  sendAdminBulkInvitations,
  updateAdminUserStatus
} from '../../api/admin';

const roleOptions = [
  { value: 'all', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'lecturer', label: 'Lecturers' },
  { value: 'admin', label: 'Admins' }
];

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' }
];

const roleLabels = {
  admin: 'Admin',
  lecturer: 'Lecturer',
  student: 'Student'
};

const statusLabels = {
  active: 'Active',
  suspended: 'Suspended'
};

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

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function buildListParams(filters) {
  return {
    page: filters.page,
    limit: 10,
    sort: 'updatedAt',
    direction: 'desc',
    ...(filters.role !== 'all' ? { role: filters.role } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {})
  };
}

const provisionRoleOptions = [
  { value: 'student', label: 'Student' },
  { value: 'lecturer', label: 'Lecturer' }
];

const importStatusPresentation = {
  valid_new: { label: 'Will be created', className: 'bg-emerald-50 text-emerald-800' },
  already_exists: { label: 'Already exists', className: 'bg-sky-50 text-sky-800' },
  duplicate_in_file: { label: 'Duplicate in file', className: 'bg-slate-100 text-slate-700' },
  conflict: { label: 'Conflict', className: 'bg-rose-50 text-rose-800' },
  invalid: { label: 'Invalid', className: 'bg-amber-50 text-amber-800' }
};

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64Workbook({ content_base64: contentBase64, filename, mime_type: mimeType }) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  triggerBrowserDownload(new Blob([bytes], { type: mimeType }), filename);
}

function ImportStatusBadge({ status }) {
  const presentation = importStatusPresentation[status] || {
    label: status || 'Unknown',
    className: 'bg-slate-100 text-slate-700'
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}

function ImportSummaryTiles({ summary }) {
  const tiles = [
    { label: 'Total rows', value: summary.total_rows, accent: 'border-l-slate-400' },
    { label: 'Will be created', value: summary.valid_new, accent: 'border-l-emerald-600' },
    { label: 'Already exist', value: summary.already_exists, accent: 'border-l-sky-500' },
    { label: 'Duplicates in file', value: summary.duplicate_in_file, accent: 'border-l-slate-400' },
    { label: 'Conflicts', value: summary.conflict, accent: 'border-l-rose-500' },
    { label: 'Invalid', value: summary.invalid, accent: 'border-l-amber-500' }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <article key={tile.label} className={`rounded-lg border border-border-subtle border-l-[3px] ${tile.accent} bg-white p-3`}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{tile.label}</p>
          <p className="mt-1 text-xl font-semibold text-text-primary">{formatCount(tile.value)}</p>
        </article>
      ))}
    </div>
  );
}

function ImportRowsTable({ rows, showAll, onToggleShowAll }) {
  const attentionRows = rows.filter((row) => row.status !== 'valid_new' || row.warnings.length > 0);
  const visibleRows = showAll ? rows : attentionRows;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">
          Row-by-row result ({formatCount(visibleRows.length)} shown)
        </p>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input checked={showAll} onChange={onToggleShowAll} type="checkbox" />
          Show all rows (including valid new accounts)
        </label>
      </div>
      {visibleRows.length === 0 ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Every row is a valid new account. Nothing needs attention.
        </p>
      ) : (
        <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-border-subtle">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                <th className="px-3 py-2 font-semibold text-text-muted">Row</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Name</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Email</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Role</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Matric</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Status</th>
                <th className="px-3 py-2 font-semibold text-text-muted">Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr className="border-t border-border-subtle align-top" key={row.row_number}>
                  <td className="px-3 py-2 text-text-secondary">{row.row_number}</td>
                  <td className="px-3 py-2 text-text-primary">{row.name || '—'}</td>
                  <td className="break-all px-3 py-2 text-text-secondary">{row.email || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.role || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.matric_number || '—'}</td>
                  <td className="px-3 py-2"><ImportStatusBadge status={row.status} /></td>
                  <td className="px-3 py-2 text-text-secondary">
                    {[...row.messages, ...row.warnings].map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CredentialManifestPanel({ commitResult, onDismiss }) {
  const manifest = commitResult.credential_manifest;

  return (
    <section
      aria-label="One-time credential manifest"
      className="rounded-[10px] border-2 border-amber-300 bg-amber-50 p-5"
    >
      <h3 className="text-lg font-semibold text-amber-900">One-time credential manifest</h3>
      <p className="mt-1 text-sm leading-6 text-amber-900">
        This download is the <strong>only copy</strong> of the {formatCount(manifest.rows)} temporary
        password{manifest.rows === 1 ? '' : 's'} for the newly created accounts. The system stores only
        secure hashes and cannot show them again. Transfer each credential through a secure channel;
        every user must change it at first login. Protect the file and delete it once distribution is
        complete. If a credential is lost later, use the per-user &quot;Reset credential&quot; action.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
          onClick={() => downloadBase64Workbook(manifest)}
          type="button"
        >
          Download credential manifest (.xlsx)
        </button>
        <button
          className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          onClick={onDismiss}
          type="button"
        >
          I have downloaded it — dismiss
        </button>
      </div>
    </section>
  );
}

function BulkImportUsersSection({ onCohortCreated }) {
  const [importFile, setImportFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [previewState, setPreviewState] = useState('idle');
  const [previewError, setPreviewError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [commitState, setCommitState] = useState('idle');
  const [commitError, setCommitError] = useState('');
  // Commit results (including the base64 manifest) live only in this
  // component's memory and are discarded on dismiss/reload.
  const [commitResult, setCommitResult] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [inviteState, setInviteState] = useState('idle');
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);

  function resetResults() {
    setPreviewState('idle');
    setPreviewError('');
    setPreviewData(null);
    setCommitState('idle');
    setCommitError('');
    setCommitResult(null);
    setInviteState('idle');
    setInviteError('');
    setInviteResult(null);
  }

  function handleFileChange(event) {
    setImportFile(event.target.files?.[0] || null);
    resetResults();
  }

  async function handleDownloadTemplate() {
    setTemplateError('');
    try {
      const { blob, filename } = await downloadAdminUserImportTemplate();
      triggerBrowserDownload(blob, filename);
    } catch {
      setTemplateError('The template could not be downloaded.');
    }
  }

  async function handlePreview() {
    if (!importFile) {
      return;
    }
    setPreviewState('loading');
    setPreviewError('');
    setPreviewData(null);
    setCommitState('idle');
    setCommitError('');
    setCommitResult(null);
    try {
      const result = await previewAdminUserImport(importFile);
      setPreviewData(result.data);
      setPreviewState('success');
    } catch (error) {
      setPreviewError(error?.response?.data?.error?.message || 'Import preview failed.');
      setPreviewState('error');
    }
  }

  async function handleCommit() {
    setShowCommitConfirm(false);
    setCommitState('loading');
    setCommitError('');
    try {
      const result = await commitAdminUserImport(importFile);
      setCommitResult(result.data);
      setCommitState('success');
      setPreviewData(null);
      setPreviewState('idle');
      setImportFile(null);
      setFileInputKey((current) => current + 1);
      if ((result.data?.created_users || []).length > 0) {
        onCohortCreated();
      }
    } catch (error) {
      const apiError = error?.response?.data?.error;
      if (apiError?.code === 'BULK_IMPORT_STATE_CHANGED') {
        setCommitError(`${apiError.message} The preview below is stale; run it again.`);
      } else {
        setCommitError(apiError?.message || 'Import commit failed. No accounts were created unless a success summary is shown.');
      }
      setCommitState('error');
    }
  }

  async function handleBulkInvite() {
    setShowInviteConfirm(false);
    const createdIds = (commitResult?.created_users || []).map((user) => user.id);
    if (createdIds.length === 0) {
      return;
    }
    setInviteState('loading');
    setInviteError('');
    try {
      const result = await sendAdminBulkInvitations(createdIds);
      setInviteResult(result.data);
      setInviteState('success');
    } catch (error) {
      setInviteError(error?.response?.data?.error?.message || 'Invitations could not be sent. No delivery is claimed for this batch; you can retry, or invite users individually.');
      setInviteState('error');
    }
  }

  const summary = previewData?.summary;
  const canCommit = previewState === 'success' && summary?.valid_new > 0 && commitState !== 'loading';
  const createdCount = (commitResult?.created_users || []).length;

  return (
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Bulk import users</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            Onboard a departmental cohort from an .xlsx spreadsheet (columns: name, email, role,
            optional matric_number). Upload a file, review the preview — nothing is created yet —
            then commit the valid new accounts. Existing accounts are never modified, and
            re-importing the same file is safe.
          </p>
        </div>
        <button
          className="w-fit rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
          onClick={handleDownloadTemplate}
          type="button"
        >
          Download template
        </button>
      </div>

      {templateError ? (
        <InfoCallout className="mt-4" message={templateError} title="Template download failed" variant="warning" />
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-text-primary">
          Spreadsheet (.xlsx)
          <input
            accept=".xlsx"
            className="mt-1 block w-full max-w-md rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-emerald-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            key={fileInputKey}
            onChange={handleFileChange}
            type="file"
          />
        </label>
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!importFile || previewState === 'loading' || commitState === 'loading'}
          onClick={handlePreview}
          type="button"
        >
          {previewState === 'loading' ? 'Previewing...' : 'Preview import'}
        </button>
        <button
          className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!canCommit}
          onClick={() => setShowCommitConfirm(true)}
          type="button"
        >
          {commitState === 'loading' ? 'Creating accounts...' : 'Commit valid new accounts'}
        </button>
      </div>

      {previewError ? (
        <InfoCallout className="mt-4" role="alert" message={previewError} title="Import preview failed" variant="warning" />
      ) : null}

      {commitError ? (
        <InfoCallout className="mt-4" role="alert" message={commitError} title="Import commit not completed" variant="warning" />
      ) : null}

      {commitState === 'loading' ? (
        <InfoCallout
          className="mt-4"
          message="Accounts and secure credentials are being created on the server. For a full departmental cohort this can take a few minutes — keep this page open."
          title="Creating accounts..."
          variant="success"
        />
      ) : null}

      {previewData && commitState !== 'success' ? (
        <div className="mt-5 space-y-4">
          <InfoCallout
            message={`Preview only — no accounts have been created. ${formatCount(summary.valid_new)} row(s) would become new accounts; ${formatCount(summary.total_rows - summary.valid_new)} row(s) will be skipped or need attention. Commit re-checks everything against the live directory.`}
            title="Previewed, not created"
            variant="success"
          />
          <ImportSummaryTiles summary={summary} />
          <ImportRowsTable
            onToggleShowAll={() => setShowAllRows((current) => !current)}
            rows={previewData.rows}
            showAll={showAllRows}
          />
        </div>
      ) : null}

      {commitResult ? (
        <div className="mt-5 space-y-4">
          <InfoCallout
            message={`${formatCount((commitResult.created_users || []).length)} account(s) were actually created. ${formatCount(commitResult.summary.already_exists)} already existed, ${formatCount(commitResult.summary.duplicate_in_file)} duplicate row(s), ${formatCount(commitResult.summary.conflict)} conflict(s) and ${formatCount(commitResult.summary.invalid)} invalid row(s) were NOT provisioned.`}
            title="Import committed"
            variant="success"
          />
          <ImportSummaryTiles summary={commitResult.summary} />
          {commitResult.credential_manifest ? (
            <CredentialManifestPanel
              commitResult={commitResult}
              onDismiss={() => setCommitResult(null)}
            />
          ) : (
            <InfoCallout
              message="No new accounts were created by this commit, so there is no credential manifest. Existing users keep their current passwords."
              title="Nothing new to provision"
              variant="success"
            />
          )}

          {createdCount > 0 ? (
            <section className="rounded-[10px] border border-sky-200 bg-sky-50/50 p-5">
              <h3 className="text-lg font-semibold text-text-primary">Email invitations (optional)</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Instead of (or in addition to) distributing the credential manifest manually, you can
                email each newly created account a secure one-time activation link so the user chooses
                their own password. Nothing is emailed until you press the button below. Accounts whose
                email fails stay listed as failed and can be re-invited individually; the manifest
                credentials remain a valid fallback until a user activates.
              </p>
              {inviteState === 'idle' || inviteState === 'error' ? (
                <button
                  className="mt-3 rounded-xl bg-sky-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-900"
                  onClick={() => setShowInviteConfirm(true)}
                  type="button"
                >
                  Send invitations to {formatCount(createdCount)} new account(s)
                </button>
              ) : null}
              {inviteState === 'loading' ? (
                <InfoCallout
                  className="mt-3"
                  message="Invitation emails are being sent one batch at a time (bounded concurrency). Keep this page open."
                  title="Sending invitations..."
                  variant="success"
                />
              ) : null}
              {inviteError ? (
                <InfoCallout className="mt-3" role="alert" message={inviteError} title="Bulk invitations not completed" variant="warning" />
              ) : null}
              {inviteResult ? (
                <div className="mt-3 space-y-3">
                  <InfoCallout
                    message={`Sent: ${formatCount(inviteResult.summary.sent)} · Failed: ${formatCount(inviteResult.summary.failed)} · Skipped: ${formatCount(inviteResult.summary.skipped)} of ${formatCount(inviteResult.summary.requested)} requested. Failed or skipped accounts were NOT sent an email — they remain on the manual credential fallback and can be invited individually from the user list.`}
                    title="Invitation delivery result"
                    variant={inviteResult.summary.failed > 0 ? 'warning' : 'success'}
                  />
                  {inviteResult.results.some((entry) => entry.status !== 'sent') ? (
                    <div className="max-h-48 overflow-auto rounded-lg border border-border-subtle bg-white p-3 text-sm text-text-secondary">
                      {inviteResult.results.filter((entry) => entry.status !== 'sent').map((entry) => (
                        <p key={entry.userId}>
                          {entry.email || `User #${entry.userId}`} — {entry.status === 'failed' ? 'delivery failed' : 'skipped'} ({entry.reasonCode})
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
          <ImportRowsTable
            onToggleShowAll={() => setShowAllRows((current) => !current)}
            rows={commitResult.rows || []}
            showAll={showAllRows}
          />
        </div>
      ) : null}

      <ConfirmActionModal
        confirmLabel={`Email ${formatCount(createdCount)} invitation(s)`}
        isConfirming={inviteState === 'loading'}
        isOpen={showInviteConfirm}
        message={`${formatCount(createdCount)} newly created account(s) will each receive an email with a secure one-time activation link. Sending happens now, synchronously, with bounded concurrency; each account gets its own truthful sent/failed result.`}
        onCancel={() => setShowInviteConfirm(false)}
        onConfirm={handleBulkInvite}
        title="Send email invitations to the new cohort?"
      />

      <ConfirmActionModal
        confirmLabel={`Create ${formatCount(summary?.valid_new || 0)} account(s)`}
        isConfirming={commitState === 'loading'}
        isOpen={showCommitConfirm}
        message={summary ? `${formatCount(summary.valid_new)} new account(s) will be created with one-time temporary passwords. Rows marked as existing, duplicate, conflicting or invalid will NOT be provisioned. The server re-validates every row before creating anything.` : ''}
        onCancel={() => setShowCommitConfirm(false)}
        onConfirm={handleCommit}
        title="Commit this import?"
      />
    </section>
  );
}

const emptyProvisionForm = {
  role: 'student',
  name: '',
  email: '',
  matricNumber: ''
};

function OneTimeCredentialPanel({ credential, onDismiss }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(credential.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      aria-label="One-time temporary credential"
      className="rounded-[10px] border-2 border-amber-300 bg-amber-50 p-5"
    >
      <h2 className="text-lg font-semibold text-amber-900">One-time temporary password</h2>
      <p className="mt-1 text-sm leading-6 text-amber-900">
        Copy it now — it will not be shown again and is stored nowhere else. Transfer it to the user
        through a secure channel. They must change it at first login before any other access.
      </p>
      <dl className="mt-4 grid gap-2 text-sm text-amber-950">
        <div className="flex flex-wrap gap-2">
          <dt className="font-bold">Account:</dt>
          <dd className="break-all">{credential.name} ({credential.email})</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="font-bold">Temporary password:</dt>
          <dd>
            <code className="rounded bg-white px-2 py-1 font-mono text-base tracking-wide">
              {credential.temporaryPassword}
            </code>
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
          onClick={handleCopy}
          type="button"
        >
          {copied ? 'Copied' : 'Copy temporary password'}
        </button>
        <button
          className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          onClick={onDismiss}
          type="button"
        >
          I have copied it — dismiss
        </button>
      </div>
    </section>
  );
}

function ProvisionUserSection({
  form,
  isSubmitting,
  onFieldChange,
  onSubmit,
  provisionError
}) {
  const isStudent = form.role === 'student';

  return (
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-sm">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-lg font-semibold text-text-primary">Create individual account</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
          Provision a student or lecturer account. The system generates a secure temporary password,
          shows it once, and requires the user to set a private password at first login.
        </p>
      </div>

      {provisionError ? (
        <InfoCallout className="mt-4" role="alert" message={provisionError} title="Account could not be created" variant="warning" />
      ) : null}

      <form className="mt-4 grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_12rem_auto] lg:items-end" onSubmit={onSubmit}>
        <label className="text-sm font-semibold text-text-primary">
          Role
          <select
            className="mt-1 w-full rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            name="role"
            onChange={onFieldChange}
            value={form.role}
          >
            {provisionRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-text-primary">
          Full name
          <input
            className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            name="name"
            onChange={onFieldChange}
            placeholder="Full name"
            required
            type="text"
            value={form.name}
          />
        </label>

        <label className="text-sm font-semibold text-text-primary">
          University email
          <input
            className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            name="email"
            onChange={onFieldChange}
            placeholder="name@uniosun.edu.ng"
            required
            type="email"
            value={form.email}
          />
        </label>

        {isStudent ? (
          <label className="text-sm font-semibold text-text-primary">
            Matric number (optional)
            <input
              className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              name="matricNumber"
              onChange={onFieldChange}
              placeholder="e.g. CSC/21/0451"
              type="text"
              value={form.matricNumber}
            />
          </label>
        ) : <span className="hidden lg:block" />}

        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </section>
  );
}

const invitationStatusPresentation = {
  pending: { label: 'Invited', className: 'bg-sky-50 text-sky-800' },
  accepted: { label: 'Invitation accepted', className: 'bg-emerald-50 text-emerald-800' },
  failed: { label: 'Invite failed', className: 'bg-rose-50 text-rose-800' },
  expired: { label: 'Invite expired', className: 'bg-amber-50 text-amber-800' }
};

function InvitationStatusBadge({ invitation }) {
  const presentation = invitationStatusPresentation[invitation?.status];
  if (!presentation) {
    return null;
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}

function UserStatusBadge({ status }) {
  const isSuspended = status === 'suspended';
  return (
    <span className={[
      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
      isSuspended ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
    ].join(' ')}>
      {statusLabels[status] || status || 'Unknown'}
    </span>
  );
}

function UserRow({ currentUserId, isInviting, isResettingCredential, isUpdating, onCredentialReset, onEditIdentity, onInvite, onStatusChange, user }) {
  const isCurrentUser = String(currentUserId || '') === String(user.id);
  const canUpdateStatus = user.role !== 'admin' && !isCurrentUser;
  const canResetCredential = user.role !== 'admin' && !isCurrentUser;
  const canEditIdentity = user.role !== 'admin';
  // Invitations only apply while the provisioned account still awaits its
  // first private password; completed accounts use credential reset instead.
  const canInvite = user.role !== 'admin' && user.status === 'active' && user.mustChangePassword;
  const inviteLabel = ['pending', 'failed', 'expired'].includes(user.invitation?.status)
    ? 'Resend invitation'
    : 'Send invitation';
  const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
  const actionLabel = nextStatus === 'suspended' ? 'Suspend account' : 'Activate account';

  return (
    <article className="rounded-lg border border-border-subtle bg-white p-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.25fr_0.65fr_0.72fr_0.8fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-white">
              {roleLabels[user.role] || user.role || 'Unknown role'}
            </span>
            <UserStatusBadge status={user.status} />
            {user.mustChangePassword ? (
              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                Awaiting first password
              </span>
            ) : null}
            <InvitationStatusBadge invitation={user.invitation} />
          </div>
          <h2 className="mt-3 truncate text-base font-semibold leading-6 text-text-primary">{user.name}</h2>
          <p className="mt-1 break-all text-sm leading-5 text-text-secondary">{user.email}</p>
          {user.matricNumber ? (
            <p className="mt-1 text-xs font-semibold text-text-muted">Matric: {user.matricNumber}</p>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Role</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{roleLabels[user.role] || 'Unknown'}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Status</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{statusLabels[user.status] || 'Unknown'}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Updated</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(user.updatedAt)}</p>
          <p className="mt-1 text-xs text-text-muted">Created {formatDate(user.createdAt)}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {canUpdateStatus ? (
            <button
              className="rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUpdating}
              onClick={() => onStatusChange(user, nextStatus)}
              type="button"
            >
              {isUpdating ? 'Updating...' : actionLabel}
            </button>
          ) : (
            <span className="rounded-xl border border-border-subtle bg-surface-muted px-3 py-2 text-sm font-semibold text-text-muted">
              Status action unavailable
            </span>
          )}
          {canResetCredential ? (
            <button
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isResettingCredential}
              onClick={() => onCredentialReset(user)}
              type="button"
            >
              {isResettingCredential ? 'Resetting...' : 'Reset credential'}
            </button>
          ) : null}
          {canInvite ? (
            <button
              className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isInviting}
              onClick={() => onInvite(user)}
              type="button"
            >
              {isInviting ? 'Sending...' : inviteLabel}
            </button>
          ) : null}
          {canEditIdentity ? (
            <button
              className="rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-muted"
              onClick={() => onEditIdentity(user)}
              type="button"
            >
              Edit identity
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AssignmentManagementSection({
  assignmentError,
  assignmentForm,
  assignmentItems,
  assignmentState,
  assignmentStatusMessage,
  creatingAssignment,
  endingAssignmentId,
  lecturers,
  onAssignmentFieldChange,
  onCreateAssignment,
  onEndAssignment,
  onRetry,
  optionsState,
  students
}) {
  const isLoading = assignmentState === 'loading';
  const hasError = assignmentState === 'error';
  const canCreate = assignmentForm.lecturerId && assignmentForm.studentId && !creatingAssignment;

  return (
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Lecturer-supervisee assignments</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            Assign active students to active lecturers. Changes are recorded in the audit log and ended assignments retain their history.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {isLoading ? 'Loading assignments' : `${assignmentItems.length} active shown`}
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="rounded-[10px] border border-emerald-100 bg-[#fbfdf8] p-4" onSubmit={onCreateAssignment}>
          <h3 className="text-base font-semibold text-text-primary">Create assignment</h3>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            Select an active lecturer and student, then add an optional note.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="text-sm font-semibold text-text-primary">
              Lecturer
              <select
                className="mt-1 w-full rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                disabled={optionsState === 'loading'}
                name="lecturerId"
                onChange={onAssignmentFieldChange}
                value={assignmentForm.lecturerId}
              >
                <option value="">Select a lecturer</option>
                {lecturers.map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name} ({lecturer.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-text-primary">
              Student
              <select
                className="mt-1 w-full rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                disabled={optionsState === 'loading'}
                name="studentId"
                onChange={onAssignmentFieldChange}
                value={assignmentForm.studentId}
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-text-primary">
              Notes
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="notes"
                onChange={onAssignmentFieldChange}
                placeholder="Optional assignment note"
                value={assignmentForm.notes}
              />
            </label>

            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canCreate}
              type="submit"
            >
              {creatingAssignment ? 'Creating assignment...' : 'Create assignment'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {assignmentStatusMessage ? (
            <InfoCallout message={assignmentStatusMessage} title="Assignment action recorded" variant="success" />
          ) : null}

          {assignmentError ? (
            <div className="rounded-[10px] border border-amber-100 bg-amber-50 p-4">
        <InfoCallout role="alert" message={assignmentError} title="Assignment workflow notice" variant="warning" />
              {hasError ? (
                <button
                  className="mt-3 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
                  onClick={onRetry}
                  type="button"
                >
                  Retry assignments
                </button>
              ) : null}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-[10px] border border-border-subtle bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasError && assignmentItems.length === 0 ? (
            <EmptyStatePanel
              title="No active assignments"
              message="No active lecturer-supervisee assignments are available."
            />
          ) : null}

          {!isLoading && !hasError && assignmentItems.length > 0 ? (
            <div className="space-y-3">
              {assignmentItems.map((assignment) => (
                <article key={assignment.id} className="rounded-[10px] border border-border-subtle bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Lecturer</p>
                      <h3 className="mt-1 text-sm font-semibold text-text-primary">{assignment.lecturer?.name || 'Unknown lecturer'}</h3>
                      <p className="mt-1 break-all text-xs text-text-secondary">{assignment.lecturer?.email || 'Email unavailable'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Student</p>
                      <h3 className="mt-1 text-sm font-semibold text-text-primary">{assignment.student?.name || 'Unknown student'}</h3>
                      <p className="mt-1 break-all text-xs text-text-secondary">{assignment.student?.email || 'Email unavailable'}</p>
                    </div>
                    <button
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={endingAssignmentId === assignment.id}
                      onClick={() => onEndAssignment(assignment)}
                      type="button"
                    >
                      {endingAssignmentId === assignment.id ? 'Ending...' : 'End assignment'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [filters, setFilters] = useState({
    role: 'all',
    search: '',
    status: 'all',
    page: 1
  });
  const [assignmentItems, setAssignmentItems] = useState([]);
  const [assignmentState, setAssignmentState] = useState('loading');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentStatusMessage, setAssignmentStatusMessage] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({
    lecturerId: '',
    studentId: '',
    notes: ''
  });
  const [lecturerOptions, setLecturerOptions] = useState([]);
  const [studentOptions, setStudentOptions] = useState([]);
  const [assignmentOptionsState, setAssignmentOptionsState] = useState('loading');
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [endingAssignmentId, setEndingAssignmentId] = useState(null);
  const [provisionForm, setProvisionForm] = useState(emptyProvisionForm);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState('');
  // Held only in component memory while the panel is open; never persisted to
  // storage, URLs, or logs, and unrecoverable once dismissed.
  const [oneTimeCredential, setOneTimeCredential] = useState(null);
  const [resettingCredentialUserId, setResettingCredentialUserId] = useState(null);
  const [pendingCredentialReset, setPendingCredentialReset] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', matricNumber: '' });
  const [editError, setEditError] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [invitingUserId, setInvitingUserId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setPageState('loading');
      setErrorMessage('');
      try {
        const result = await listAdminUsers(buildListParams(filters));
        if (!isMounted) {
          return;
        }
        setUsers(result.data?.items || []);
        setMeta(result.meta || null);
        setPageState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setUsers([]);
        setMeta(null);
        setErrorMessage(error?.response?.data?.error?.message || 'User records could not be loaded.');
        setPageState('error');
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  async function loadAssignmentWorkflow() {
    setAssignmentState('loading');
    setAssignmentOptionsState('loading');
    setAssignmentError('');

    try {
      const [assignmentResult, lecturerResult, studentResult] = await Promise.all([
        listAdminSuperviseeAssignments({
          status: 'active',
          limit: 25
        }),
        listAdminUsers({
          role: 'lecturer',
          status: 'active',
          limit: 100,
          sort: 'name',
          direction: 'asc'
        }),
        listAdminUsers({
          role: 'student',
          status: 'active',
          limit: 100,
          sort: 'name',
          direction: 'asc'
        })
      ]);

      setAssignmentItems(assignmentResult.data?.items || []);
      setLecturerOptions(lecturerResult.data?.items || []);
      setStudentOptions(studentResult.data?.items || []);
      setAssignmentState('success');
      setAssignmentOptionsState('success');
    } catch (error) {
      setAssignmentItems([]);
      setLecturerOptions([]);
      setStudentOptions([]);
      setAssignmentError(error?.response?.data?.error?.message || 'Assignment workflow data could not be loaded.');
      setAssignmentState('error');
      setAssignmentOptionsState('error');
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialAssignmentWorkflow() {
      setAssignmentState('loading');
      setAssignmentOptionsState('loading');
      setAssignmentError('');

      try {
        const [assignmentResult, lecturerResult, studentResult] = await Promise.all([
          listAdminSuperviseeAssignments({
            status: 'active',
            limit: 25
          }),
          listAdminUsers({
            role: 'lecturer',
            status: 'active',
            limit: 100,
            sort: 'name',
            direction: 'asc'
          }),
          listAdminUsers({
            role: 'student',
            status: 'active',
            limit: 100,
            sort: 'name',
            direction: 'asc'
          })
        ]);

        if (!isMounted) {
          return;
        }

        setAssignmentItems(assignmentResult.data?.items || []);
        setLecturerOptions(lecturerResult.data?.items || []);
        setStudentOptions(studentResult.data?.items || []);
        setAssignmentState('success');
        setAssignmentOptionsState('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAssignmentItems([]);
        setLecturerOptions([]);
        setStudentOptions([]);
        setAssignmentError(error?.response?.data?.error?.message || 'Assignment workflow data could not be loaded.');
        setAssignmentState('error');
        setAssignmentOptionsState('error');
      }
    }

    loadInitialAssignmentWorkflow();

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return users.reduce((summary, item) => {
      const next = { ...summary };
      next[item.role] = (next[item.role] || 0) + 1;
      next[item.status] = (next[item.status] || 0) + 1;
      return next;
    }, {
      active: 0,
      admin: 0,
      lecturer: 0,
      student: 0,
      suspended: 0
    });
  }, [users]);

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

  function handleStatusChange(targetUser, nextStatus) {
    setPendingStatusChange({ targetUser, nextStatus });
  }

  async function confirmStatusChange() {
    if (!pendingStatusChange) return;
    const { targetUser, nextStatus } = pendingStatusChange;
    setUpdatingUserId(targetUser.id);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const result = await updateAdminUserStatus(targetUser.id, nextStatus);
      const updatedUser = result.data?.user;
      if (updatedUser) {
        setUsers((current) => current.map((item) => (
          item.id === updatedUser.id ? updatedUser : item
        )));
      }
        setStatusMessage(`Account status updated for ${targetUser.email}.`);
      setPendingStatusChange(null);
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || 'Account status could not be updated.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  function handleProvisionFieldChange(event) {
    const { name, value } = event.target;
    setProvisionForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'role' && value !== 'student' ? { matricNumber: '' } : {})
    }));
  }

  async function handleProvisionSubmit(event) {
    event.preventDefault();
    setProvisioning(true);
    setProvisionError('');
    setOneTimeCredential(null);

    try {
      const result = await createAdminUser({
        role: provisionForm.role,
        name: provisionForm.name,
        email: provisionForm.email,
        ...(provisionForm.role === 'student' && provisionForm.matricNumber.trim()
          ? { matricNumber: provisionForm.matricNumber.trim() }
          : {})
      });
      const createdUser = result.data?.item;
      if (createdUser) {
        setUsers((current) => [createdUser, ...current]);
      }
      setOneTimeCredential({
        name: createdUser?.name || provisionForm.name,
        email: createdUser?.email || provisionForm.email,
        temporaryPassword: result.data?.temporaryPassword || ''
      });
      setProvisionForm(emptyProvisionForm);
    } catch (error) {
      setProvisionError(error?.response?.data?.error?.message || 'Account could not be created.');
    } finally {
      setProvisioning(false);
    }
  }

  function handleCredentialReset(targetUser) {
    setPendingCredentialReset(targetUser);
  }

  function handleInvite(targetUser) {
    setPendingInvite(targetUser);
  }

  async function confirmInvite() {
    if (!pendingInvite) return;
    const targetUser = pendingInvite;
    setInvitingUserId(targetUser.id);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const result = await inviteAdminUser(targetUser.id);
      const updatedUser = result.data?.item;
      if (updatedUser) {
        setUsers((current) => current.map((item) => (
          item.id === updatedUser.id ? updatedUser : item
        )));
      }
      if (result.data?.delivery?.status === 'sent') {
        setStatusMessage(`Invitation email sent to ${targetUser.email}. Any previous invitation link is now invalid.`);
      } else {
        setErrorMessage(`The invitation email to ${targetUser.email} could not be delivered (${result.data?.delivery?.reasonCode || 'delivery failed'}). The account is unchanged — retry later or use the manual credential fallback.`);
      }
      setPendingInvite(null);
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || 'Invitation could not be sent.');
      setPendingInvite(null);
    } finally {
      setInvitingUserId(null);
    }
  }

  function reloadUsers() {
    setFilters((current) => ({ ...current }));
  }

  function handleEditIdentity(targetUser) {
    setEditError('');
    setEditForm({
      name: targetUser.name || '',
      email: targetUser.email || '',
      matricNumber: targetUser.matricNumber || ''
    });
    setEditingUser(targetUser);
  }

  function handleEditFieldChange(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function confirmIdentityCorrection() {
    if (!editingUser) return;
    setSavingIdentity(true);
    setEditError('');
    try {
      // Only identity fields are sent; role and status are never editable here.
      const result = await correctAdminUserIdentity(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        ...(editingUser.role === 'student' ? { matricNumber: editForm.matricNumber } : {})
      });
      const updatedUser = result.data?.item;
      if (updatedUser) {
        setUsers((current) => current.map((item) => (
          item.id === updatedUser.id ? updatedUser : item
        )));
      }
      const changed = result.data?.changedFields || [];
      setStatusMessage(changed.length
        ? `Identity updated for ${updatedUser?.email || editingUser.email} (${changed.join(', ')}).${result.data?.sessionsInvalidated ? ' The login email changed, so their existing sessions were signed out.' : ''}`
        : 'No identity fields were changed.');
      setEditingUser(null);
    } catch (error) {
      setEditError(error?.response?.data?.error?.message || 'Identity could not be updated.');
    } finally {
      setSavingIdentity(false);
    }
  }

  async function confirmCredentialReset() {
    if (!pendingCredentialReset) return;
    const targetUser = pendingCredentialReset;
    setResettingCredentialUserId(targetUser.id);
    setProvisionError('');
    setOneTimeCredential(null);
    try {
      const result = await resetAdminUserCredential(targetUser.id);
      const updatedUser = result.data?.item;
      if (updatedUser) {
        setUsers((current) => current.map((item) => (
          item.id === updatedUser.id ? updatedUser : item
        )));
      }
      setOneTimeCredential({
        name: updatedUser?.name || targetUser.name,
        email: updatedUser?.email || targetUser.email,
        temporaryPassword: result.data?.temporaryPassword || ''
      });
      setPendingCredentialReset(null);
    } catch (error) {
      setProvisionError(error?.response?.data?.error?.message || 'Credential could not be reset.');
      setPendingCredentialReset(null);
    } finally {
      setResettingCredentialUserId(null);
    }
  }

  function handleAssignmentFieldChange(event) {
    const { name, value } = event.target;
    setAssignmentForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();
    setCreatingAssignment(true);
    setAssignmentError('');
    setAssignmentStatusMessage('');

    try {
      const result = await createAdminSuperviseeAssignment({
        lecturerId: Number(assignmentForm.lecturerId),
        studentId: Number(assignmentForm.studentId),
        notes: assignmentForm.notes
      });
      const created = result.data?.item;
      if (created) {
        setAssignmentItems((current) => [created, ...current]);
      }
      setAssignmentForm({
        lecturerId: '',
        studentId: '',
        notes: ''
      });
      setAssignmentStatusMessage('Supervisee assignment created.');
    } catch (error) {
      setAssignmentError(error?.response?.data?.error?.message || 'Supervisee assignment could not be created.');
    } finally {
      setCreatingAssignment(false);
    }
  }

  async function handleEndAssignment(assignment) {
    const confirmed = window.confirm(`End assignment between ${assignment.lecturer?.email || 'this lecturer'} and ${assignment.student?.email || 'this student'}? This keeps a historical record.`);
    if (!confirmed) {
      return;
    }

    setEndingAssignmentId(assignment.id);
    setAssignmentError('');
    setAssignmentStatusMessage('');

    try {
      const result = await endAdminSuperviseeAssignment(assignment.id);
      const ended = result.data?.item;
      setAssignmentItems((current) => current.filter((item) => item.id !== assignment.id));
      setAssignmentStatusMessage(`Assignment ended for ${ended?.student?.email || assignment.student?.email || 'the selected student'}.`);
    } catch (error) {
      setAssignmentError(error?.response?.data?.error?.message || 'Supervisee assignment could not be ended.');
    } finally {
      setEndingAssignmentId(null);
    }
  }

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Account governance"
        title="User Management"
        subtitle="Review account records, assignments and account status."
      />

      <section aria-label="User summary">
            <div aria-live="polite" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-lg border border-border-subtle border-l-[3px] border-l-emerald-600 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Visible rows</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(users.length)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Accounts matching the current filters.</p>
              </article>
              <article className="rounded-lg border border-border-subtle border-l-[3px] border-l-blue-500 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Students</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.student)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Students in the current results.</p>
              </article>
              <article className="rounded-lg border border-border-subtle border-l-[3px] border-l-amber-500 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Lecturers</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.lecturer)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Lecturers in the current results.</p>
              </article>
              <article className="rounded-lg border border-border-subtle border-l-[3px] border-l-rose-500 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Suspended</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.suspended)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Status from stored user records.</p>
              </article>
            </div>

      </section>

      <ProvisionUserSection
        form={provisionForm}
        isSubmitting={provisioning}
        onFieldChange={handleProvisionFieldChange}
        onSubmit={handleProvisionSubmit}
        provisionError={provisionError}
      />

      {oneTimeCredential ? (
        <OneTimeCredentialPanel
          credential={oneTimeCredential}
          onDismiss={() => setOneTimeCredential(null)}
        />
      ) : null}

      <BulkImportUsersSection onCohortCreated={reloadUsers} />

      <AssignmentManagementSection
        assignmentError={assignmentError}
        assignmentForm={assignmentForm}
        assignmentItems={assignmentItems}
        assignmentState={assignmentState}
        assignmentStatusMessage={assignmentStatusMessage}
        creatingAssignment={creatingAssignment}
        endingAssignmentId={endingAssignmentId}
        lecturers={lecturerOptions}
        onAssignmentFieldChange={handleAssignmentFieldChange}
        onCreateAssignment={handleCreateAssignment}
        onEndAssignment={handleEndAssignment}
        onRetry={loadAssignmentWorkflow}
        optionsState={assignmentOptionsState}
        students={studentOptions}
      />

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Account records</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Search and filter the account directory by role and status.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto] lg:min-w-[48rem]" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-text-primary">
              <span className="sr-only">Search users</span>
              <input
                className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="search"
                onChange={handleFieldChange}
                placeholder="Search name or email"
                type="search"
                value={filters.search}
              />
            </label>
            <label className="text-sm font-semibold text-text-primary">
              <span className="sr-only">Role</span>
              <select
                className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="role"
                onChange={handleFieldChange}
                value={filters.role}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-text-primary">
              <span className="sr-only">Status</span>
              <select
                className="w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="status"
                onChange={handleFieldChange}
                value={filters.status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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

        <div className="mt-5 space-y-4">
          {statusMessage ? (
            <InfoCallout message={statusMessage} title="Status update recorded" variant="success" />
          ) : null}

          {errorMessage ? (
        <InfoCallout role={hasError ? 'alert' : undefined} message={errorMessage} title={hasError ? 'User records unavailable' : 'User management notice'} variant="warning" />
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-[10px] border border-border-subtle bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !hasError && users.length === 0 ? (
            <EmptyStatePanel
              message="No accounts match the selected filters."
              title="No user records"
            />
          ) : null}

          {!isLoading && !hasError && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((item) => (
                <UserRow
                  currentUserId={currentUser?.id}
                  isInviting={invitingUserId === item.id}
                  isResettingCredential={resettingCredentialUserId === item.id}
                  isUpdating={updatingUserId === item.id}
                  key={item.id}
                  onCredentialReset={handleCredentialReset}
                  onEditIdentity={handleEditIdentity}
                  onInvite={handleInvite}
                  onStatusChange={handleStatusChange}
                  user={item}
                />
              ))}
            </div>
          ) : null}
        </div>

        {meta?.pagination ? (
          <div className="mt-5 flex flex-col gap-2 rounded-[1rem] border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {formatCount(users.length)} of {formatCount(meta.pagination.total)} matching users.
            </span>
            <span>
              Page {formatCount(meta.pagination.page)} of {formatCount(meta.pagination.totalPages)}
            </span>
          </div>
        ) : null}
      </section>

      <ConfirmActionModal
        confirmLabel={pendingInvite && ['pending', 'failed', 'expired'].includes(pendingInvite.invitation?.status) ? 'Resend invitation' : 'Send invitation'}
        isConfirming={Boolean(invitingUserId)}
        isOpen={Boolean(pendingInvite)}
        message={pendingInvite ? `${pendingInvite.email} will receive an email with a secure one-time activation link to choose their own password. ${pendingInvite.invitation?.status === 'pending' ? 'The previously sent invitation link will stop working.' : ''} The manual temporary-credential fallback remains available if email fails.` : ''}
        onCancel={() => setPendingInvite(null)}
        onConfirm={confirmInvite}
        title="Send account invitation email?"
      />

      <ConfirmActionModal
        confirmLabel="Save identity corrections"
        isConfirming={savingIdentity}
        isOpen={Boolean(editingUser)}
        message={editingUser ? `Correct the stored identity data for this ${roleLabels[editingUser.role] || 'user'} account. The role cannot be changed here, and the password is not affected. Changing the email signs the user out of existing sessions.` : ''}
        onCancel={() => setEditingUser(null)}
        onConfirm={confirmIdentityCorrection}
        title="Edit account identity"
      >
        {editingUser ? (
          <div className="grid gap-3">
            {editError ? (
              <InfoCallout role="alert" message={editError} title="Identity not updated" variant="warning" />
            ) : null}
            <label className="text-sm font-semibold text-text-primary">
              Full name
              <input
                className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="name"
                onChange={handleEditFieldChange}
                type="text"
                value={editForm.name}
              />
            </label>
            <label className="text-sm font-semibold text-text-primary">
              University email
              <input
                className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                name="email"
                onChange={handleEditFieldChange}
                type="email"
                value={editForm.email}
              />
            </label>
            {editingUser.role === 'student' ? (
              <label className="text-sm font-semibold text-text-primary">
                Matric number (leave blank to remove)
                <input
                  className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  name="matricNumber"
                  onChange={handleEditFieldChange}
                  type="text"
                  value={editForm.matricNumber}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </ConfirmActionModal>

      <ConfirmActionModal
        confirmLabel="Issue new temporary password"
        isConfirming={Boolean(resettingCredentialUserId)}
        isOpen={Boolean(pendingCredentialReset)}
        message={pendingCredentialReset ? `${pendingCredentialReset.email} will get a new one-time temporary password. Their current password and all active sessions stop working immediately, and they must set a new password at next login.` : ''}
        onCancel={() => setPendingCredentialReset(null)}
        onConfirm={confirmCredentialReset}
        title="Reset this account's credential?"
        variant="danger"
      />

      <ConfirmActionModal
        confirmLabel={pendingStatusChange?.nextStatus === 'suspended' ? 'Suspend account' : 'Activate account'}
        isConfirming={Boolean(updatingUserId)}
        isOpen={Boolean(pendingStatusChange)}
        message={pendingStatusChange ? `${pendingStatusChange.targetUser.email} will be ${pendingStatusChange.nextStatus === 'suspended' ? 'unable' : 'able'} to sign in.` : ''}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={confirmStatusChange}
        title={pendingStatusChange?.nextStatus === 'suspended' ? 'Suspend this account?' : 'Activate this account?'}
        variant={pendingStatusChange?.nextStatus === 'suspended' ? 'danger' : 'default'}
      />
    </AdminDashboardLayout>
  );
}

export default UserManagementPage;
