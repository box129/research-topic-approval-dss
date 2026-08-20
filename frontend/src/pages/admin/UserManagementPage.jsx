import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import { useAuth } from '../../auth/useAuth';
import {
  createAdminSuperviseeAssignment,
  createAdminUser,
  endAdminSuperviseeAssignment,
  listAdminSuperviseeAssignments,
  listAdminUsers,
  resetAdminUserCredential,
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

function UserRow({ currentUserId, isResettingCredential, isUpdating, onCredentialReset, onStatusChange, user }) {
  const isCurrentUser = String(currentUserId || '') === String(user.id);
  const canUpdateStatus = user.role !== 'admin' && !isCurrentUser;
  const canResetCredential = user.role !== 'admin' && !isCurrentUser;
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
                  isResettingCredential={resettingCredentialUserId === item.id}
                  isUpdating={updatingUserId === item.id}
                  key={item.id}
                  onCredentialReset={handleCredentialReset}
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
