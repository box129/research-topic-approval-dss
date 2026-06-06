import { useEffect, useMemo, useState } from 'react';
import AdminDashboardLayout from '../../layouts/AdminDashboardLayout';
import EmptyStatePanel from '../../components/ui/EmptyStatePanel';
import InfoCallout from '../../components/ui/InfoCallout';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../auth/AuthContext';
import { listAdminUsers, updateAdminUserStatus } from '../../api/admin';

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

function UserRow({ currentUserId, isUpdating, onStatusChange, user }) {
  const isCurrentUser = String(currentUserId || '') === String(user.id);
  const canUpdateStatus = user.role !== 'admin' && !isCurrentUser;
  const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
  const actionLabel = nextStatus === 'suspended' ? 'Suspend account' : 'Activate account';

  return (
    <article className="rounded-[1.15rem] border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.25fr_0.65fr_0.72fr_0.8fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-white">
              {roleLabels[user.role] || user.role || 'Unknown role'}
            </span>
            <UserStatusBadge status={user.status} />
          </div>
          <h2 className="mt-3 truncate text-base font-semibold leading-6 text-text-primary">{user.name}</h2>
          <p className="mt-1 break-all text-sm leading-5 text-text-secondary">{user.email}</p>
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
        </div>
      </div>
    </article>
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
  const [filters, setFilters] = useState({
    role: 'all',
    search: '',
    status: 'all',
    page: 1
  });

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

  async function handleStatusChange(targetUser, nextStatus) {
    const verb = nextStatus === 'suspended' ? 'suspend' : 'activate';
    const confirmed = window.confirm(`Confirm ${verb} for ${targetUser.email}? This audited action changes only account status.`);
    if (!confirmed) {
      return;
    }

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
      setStatusMessage(`Account status updated for ${targetUser.email}. Audit event USER_STATUS_CHANGED was requested.`);
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || 'Account status could not be updated.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  const isLoading = pageState === 'loading';
  const hasError = pageState === 'error';

  return (
    <AdminDashboardLayout className="space-y-5">
      <PageHeader
        eyebrow="Account governance"
        title="User Management"
        subtitle="Read-only user directory connected to existing account records, with a narrow audited status action. No fake users, role changes, invitations, password resets, or delete controls are exposed."
      />

      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#eef4eb] shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)]">
        <div className="grid gap-0 xl:grid-cols-[0.76fr_1.24fr]">
          <div className="bg-[linear-gradient(150deg,#022c22,#064e3b)] p-5 text-white sm:p-7">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">
                  Real account records
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Admin user console</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">Directory and account status</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">
                    Review existing users by role and status. Account creation, role changes, resets, invitations, and deletion stay deferred.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">Mutation boundary</p>
                <p className="mt-1 text-xl font-semibold text-white">Status only, audited</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                  The only enabled action is a constrained active or suspended status update for non-admin accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6 lg:p-7">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-emerald-600 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Visible rows</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(users.length)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Current filtered page from the admin users endpoint.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-blue-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Students</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.student)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Counted only from returned records.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-amber-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Lecturers</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.lecturer)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">No workload or assignment counts are inferred.</p>
              </article>
              <article className="rounded-[1rem] border border-border-subtle border-l-4 border-l-rose-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Suspended</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{isLoading ? 'Loading...' : formatCount(totals.suspended)}</p>
                <p className="mt-2 text-sm leading-5 text-text-secondary">Status from stored user records.</p>
              </article>
            </div>

            <InfoCallout
              title="No privileged account workflow is invented"
              message="This page does not create users, change roles, reset passwords, invite accounts, delete records, or show fake last-active values."
              variant="info"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Account records</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Filters call the admin users endpoint with safe pagination and sorting. Sensitive fields are not rendered.
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
            <InfoCallout message={errorMessage} title="User management notice" variant="warning" />
          ) : null}

          {hasError ? (
            <InfoCallout
              message="The read-only user endpoint could not be reached. No fallback user rows are displayed."
              title="User records unavailable"
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

          {!isLoading && !hasError && users.length === 0 ? (
            <EmptyStatePanel
              message="The users endpoint returned an empty list for the selected filters. No placeholder accounts are shown."
              title="No user records returned"
            />
          ) : null}

          {!isLoading && !hasError && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((item) => (
                <UserRow
                  currentUserId={currentUser?.id}
                  isUpdating={updatingUserId === item.id}
                  key={item.id}
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
    </AdminDashboardLayout>
  );
}

export default UserManagementPage;
