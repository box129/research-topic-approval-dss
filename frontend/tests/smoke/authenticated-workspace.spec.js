import { expect, test } from '@playwright/test';

const evidenceDirectory = 'test-results/authenticated-workspace-rollout';
const observations = new WeakMap();
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

test.use({
  colorScheme: 'light',
  locale: 'en-GB',
  reducedMotion: 'reduce',
  timezoneId: 'Africa/Lagos'
});

const studentSubmissions = [
  {
    id: 71,
    title: 'Community health education approaches for improving maternal care participation',
    category: 'Public Health',
    keywords: 'maternal health, community education',
    status: 'awaiting_revision',
    submitted_at: '2026-06-22T08:00:00.000Z',
    decision_reason: 'Narrow the population and state the study location.',
    decided_at: '2026-06-24T09:30:00.000Z'
  },
  {
    id: 70,
    title: 'Digital library access patterns among undergraduate students in regional universities',
    category: 'Information Science',
    keywords: 'digital library, access',
    status: 'approved',
    submitted_at: '2026-05-18T08:00:00.000Z',
    decision_reason: 'The scope is sufficiently specific for the proposed study.',
    decided_at: '2026-05-21T11:00:00.000Z'
  }
];

const pendingSubmissions = [
  {
    id: 42,
    title: 'Assessment of community-based malaria prevention awareness among students in rural secondary schools',
    status: 'pending_review',
    category: 'Public Health',
    keywords: 'malaria, prevention, rural schools',
    student_name: 'Student Record',
    student_email: 'student.record@uniosun.edu.ng',
    session_name: '2025/2026',
    submitted_at: '2026-06-20T10:00:00.000Z',
    created_at: '2026-06-19T10:00:00.000Z'
  },
  {
    id: 43,
    title: 'Machine learning methods for improving university library resource recommendations',
    status: 'pending_review',
    category: 'Computer Science',
    keywords: 'machine learning, library',
    student_name: 'Second Student',
    student_email: 'second.student@uniosun.edu.ng',
    session_name: '2025/2026',
    submitted_at: '2026-06-21T08:00:00.000Z'
  }
];

const users = [
  { id: 1, name: 'Administrator Record', email: 'admin.record@uniosun.edu.ng', role: 'admin', status: 'active', createdAt: '2026-04-01T10:00:00.000Z', updatedAt: '2026-06-20T10:00:00.000Z' },
  { id: 2, name: 'Student Record', email: 'student.record@uniosun.edu.ng', role: 'student', status: 'active', createdAt: '2026-04-02T10:00:00.000Z', updatedAt: '2026-06-21T10:00:00.000Z' },
  { id: 3, name: 'Lecturer Record', email: 'lecturer.record@uniosun.edu.ng', role: 'lecturer', status: 'suspended', createdAt: '2026-04-03T10:00:00.000Z', updatedAt: '2026-06-22T10:00:00.000Z' }
];

const topicItems = [
  {
    id: 10,
    lifecycle: 'historical',
    title: 'Maternal care participation through community health education',
    keywords: 'maternal care, health education',
    category: 'Public Health',
    sessionYear: '2024/2025',
    supervisorName: 'Stored Supervisor',
    sourceType: 'spreadsheet',
    dataQuality: { hasEmbedding: true, hasContextFields: true, hasImportWarnings: false, importWarningCount: 0 }
  },
  {
    id: 11,
    lifecycle: 'under-review',
    title: 'Digital access and academic library participation in public universities',
    keywords: 'digital access, academic libraries',
    category: null,
    sessionYear: null,
    supervisorName: null,
    sourceType: 'manual',
    dataQuality: { hasEmbedding: false, hasContextFields: false, hasImportWarnings: true, importWarningCount: 1 }
  }
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function pagination(total) {
  return { page: 1, limit: 10, total, totalPages: 1, hasNextPage: false, hasPreviousPage: false };
}

async function installMocks(page, role) {
  const currentUser = {
    id: role === 'admin' ? 1 : role === 'lecturer' ? 8 : 7,
    name: `${role === 'admin' ? 'Administrator' : role === 'lecturer' ? 'Lecturer' : 'Student'} Evidence`,
    email: `${role}.evidence@uniosun.edu.ng`,
    role
  };

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');

    if (path === '/auth/me') return json(route, { data: { user: currentUser } });
    if (path.startsWith('/notifications')) return json(route, { data: { items: [] }, meta: { unreadCount: 0 } });
    if (path === '/submissions' && request.method() === 'GET') return json(route, { data: { submissions: studentSubmissions } });
    if (path === '/submissions' && request.method() === 'POST') return json(route, { data: { submission: { id: 72, status: 'pending_review' } } }, 201);

    if (path === '/lecturer/submissions' && request.method() === 'GET') return json(route, { data: { submissions: pendingSubmissions } });
    if (path === '/lecturer/decisions') return json(route, {
      data: { items: [{ id: 39, title: 'Evaluation of community health communication strategies', studentName: 'Decision Student', studentEmail: 'decision.student@uniosun.edu.ng', category: 'Public Health', status: 'APPROVED', submittedAt: '2026-05-19T10:00:00.000Z', decidedAt: '2026-05-22T10:00:00.000Z', decisionFeedback: 'Approved after review.', similaritySnapshotId: 88 }] },
      meta: { pagination: pagination(1), filters: {}, dataCoverage: 'Stored lecturer decisions.' }
    });
    if (path === '/lecturer/supervisees') return json(route, {
      data: { items: [{ id: 10, student: { id: 3, name: 'Assigned Student', email: 'assigned.student@uniosun.edu.ng', role: 'student', status: 'active' }, lecturer: currentUser, assignedAt: '2026-06-22T09:00:00.000Z', latestSubmission: { id: 71, title: 'Community health education approaches for maternal care participation', category: 'Public Health', status: 'pending_review', submittedAt: '2026-06-22T08:00:00.000Z', decidedAt: null } }] },
      meta: { pagination: pagination(1) }
    });
    if (path === '/lecturer/research-trends') return json(route, {
      data: {
        topics: { total: 45, byLifecycle: { historical: 30, currentSession: 10, underReview: 5 }, byCategory: [{ category: 'Public Health', count: 14 }, { category: 'Software Engineering', count: 6 }], bySessionYear: [{ sessionYear: '2024/2025', count: 12 }, { sessionYear: '2025/2026', count: 11 }] },
        submissions: { total: 8, byStatus: { pendingReview: 2, awaitingRevision: 1, approved: 4, rejected: 1 }, decisionCoverage: { decided: 6, pending: 2 }, byCategory: [{ category: 'Public Health', count: 3 }] },
        similarityChecks: { snapshots: 7, byRisk: { high: 1, medium: 2, low: 3, unknown: 1 }, byResponseStatus: { success: 5, partialSuccess: 2, error: 0, other: 0 }, notes: ['Counts use stored lecturer similarity snapshots.'] },
        keywordTrends: { status: 'unavailable', message: 'Keyword trends are not currently available.' },
        recommendations: { status: 'unavailable', message: 'Research recommendations are not currently available.' },
        warnings: []
      },
      meta: { generatedAt: '2026-06-07T16:00:00.000Z', dataCoverage: 'Stored aggregate records.' }
    });
    if (/^\/lecturer\/submissions\/\d+\/similarity-snapshots$/.test(path)) return json(route, { data: { snapshots: [{ id: 7, overall_risk: 'HIGH', response_status: 'success', checked_by: { name: 'Evidence Lecturer', email: 'evidence@uniosun.edu.ng' }, created_at: '2026-06-21T10:00:00.000Z', max_similarity: 87.45, result_summary: { tierCounts: { historical: 2, currentSession: 1, underReview: 3 } }, recommendation: 'Review the high overlap before deciding.' }] } });
    if (/^\/lecturer\/submissions\/\d+\/status$/.test(path) && request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      return json(route, { data: { submission: { ...pendingSubmissions[0], status: payload.status, decision_reason: payload.reason || null, decided_by_name: currentUser.name, decided_at: '2026-06-25T10:00:00.000Z' } } });
    }
    if (/^\/lecturer\/submissions\/\d+$/.test(path)) return json(route, { data: { submission: pendingSubmissions[0] } });

    if (path === '/admin/dashboard/summary') return json(route, {
      data: {
        users: { total: 6, students: 3, lecturers: 2, admins: 1, active: 5, suspended: 1, status: 'available' },
        submissions: { total: 8, pendingReview: 4, awaitingRevision: 1, approved: 2, rejected: 1, status: 'available' },
        topics: { total: 45, historical: 30, currentSession: 10, underReview: 5, status: 'available' },
        similarityChecks: { snapshots: 7, highRisk: 1, mediumRisk: 2, lowRisk: 4, status: 'available', notes: [] },
        serviceHealth: { api: { status: 'available', message: 'API responded.' }, database: { status: 'available', message: 'Database counts are available.' }, semanticProvider: { status: 'unknown', provider: 'voyage', model: 'voyage-4-large', message: 'Voyage semantic provider (voyage-4-large) health is not checked by this dashboard endpoint yet.' } },
        warnings: []
      },
      meta: { generatedAt: '2026-06-25T10:00:00.000Z', dataCoverage: 'Stored administrative metrics.' }
    });
    if (path === '/admin/users') {
      const selected = url.searchParams.get('role');
      const items = selected && selected !== 'all' ? users.filter(user => user.role === selected) : users;
      return json(route, { data: { items }, meta: { pagination: pagination(items.length), filters: {} } });
    }
    if (/^\/admin\/users\/\d+\/status$/.test(path)) {
      const payload = request.postDataJSON();
      const id = Number(path.split('/')[3]);
      return json(route, { data: { user: { ...users.find(user => user.id === id), status: payload.status }, auditEventType: 'USER_STATUS_CHANGED' } });
    }
    if (path === '/admin/supervisee-assignments') return json(route, { data: { items: [] }, meta: {} });
    if (path === '/admin/topics/summary') return json(route, { data: { totals: { all: 3, historical: 1, currentSession: 1, underReview: 1 }, byCategory: [{ category: 'Public Health', count: 2 }], bySessionYear: [{ sessionYear: '2025/2026', count: 2 }], dataQuality: { missingCategory: 1, missingSessionYear: 0, missingSupervisorName: 0, missingContextFields: 1, withEmbeddings: 1, withoutEmbeddings: 2, withImportWarnings: 1 } }, meta: {} });
    if (path === '/admin/topics') return json(route, { data: { items: topicItems }, meta: { pagination: pagination(topicItems.length), filters: {} } });
    if (path === '/admin/import/topics/preview') return json(route, { status: 'success', data: { mode: 'preview', metadata: { sheet_name: 'Topics', total_parsed_rows: 5 }, records: [{ title: 'Community health evidence', lifecycle_bucket: 'historical' }, { title: 'Digital library participation', lifecycle_bucket: 'current_session' }, { title: 'Preventive health communication', lifecycle_bucket: 'under_review' }], import_report: { total_rows: 5, accepted_rows: 3, skipped_rows: 2, missing_title_rows: 1, incomplete_context_rows: 2, duplicate_title_rows: 1 } } });
    if (path === '/admin/settings') return json(route, { data: { items: [{ key: 'demo_auth_users_notice', value: 'Demo users are available for local authentication testing.', updatedAt: '2026-06-05T10:00:00.000Z', updatedBy: null }] }, meta: { dataCoverage: 'Stored system settings.', mutationStatus: 'Read only.' } });
    if (path === '/admin/audit-logs') return json(route, { data: { items: [{ id: 42, event_type: 'USER_STATUS_CHANGED', actor: { id: 1, role: 'admin', email: 'admin.record@uniosun.edu.ng' }, target: { type: 'User', id: '7' }, request: { id: 'req-123', ip_address: '127.0.0.1', user_agent: 'Playwright' }, metadata: { status: 'suspended' }, created_at: '2026-06-06T10:00:00.000Z' }] }, meta: { pagination: pagination(1), filters: {} } });
    if (path === '/admin/audit-logs/purge-preview') return json(route, { data: { purgePreview: { cutoffDate: '2025-06-22T12:00:00.000Z', olderThanDays: 365, candidateCount: 4, willDeleteCount: 4, maxBatch: 1000, policy: { retentionDays: 365, purgeMinAgeDays: 90, confirmationPhrase: 'CONFIRM_AUDIT_PURGE' }, summary: { byEventType: [{ eventType: 'USER_STATUS_CHANGED', count: 4 }], byActorRole: [{ actorRole: 'admin', count: 4 }] } } } });
    if (path === '/admin/reports/summary') return json(route, {
      data: {
        users: { total: 6, byRole: { students: 3, lecturers: 2, admins: 1 }, byStatus: { active: 5, suspended: 1 } },
        submissions: { total: 8, byStatus: { pendingReview: 2, awaitingRevision: 1, approved: 4, rejected: 1 }, decisionCoverage: { decided: 6, pending: 2 } },
        topics: { total: 45, byLifecycle: { historical: 30, currentSession: 10, underReview: 5 } },
        similarityChecks: { snapshots: 7, byRisk: { high: 1, medium: 2, low: 3, unknown: 1 }, byResponseStatus: { success: 5, partialSuccess: 1, error: 1, other: 0 }, notes: [] },
        auditLogs: { total: 4, byActorRole: { admin: 3, lecturer: 1, student: 0, unknown: 0 }, topEventTypes: [{ eventType: 'USER_STATUS_CHANGED', count: 2 }] },
        exports: { status: 'csv_available', message: 'CSV exports are available.' }, warnings: []
      },
      meta: { generatedAt: '2026-06-25T10:00:00.000Z', dataCoverage: 'Stored report aggregates.' }
    });

    return json(route, { data: {} });
  });

  await page.route('**/api/similarity/check', route => json(route, {
    status: 'success',
    data: { overall_risk: 'LOW', max_similarity: 18, recommendation: 'No high-similarity records were identified by this check. Review the proposal and its context before making a submission or approval decision.', tier1_historical: [], tier2_current: [], tier3_under_review: [] }
  }));
}

async function openRoute(page, path, role, heading) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Research Topic Approval DSS home' })).toHaveAttribute('href', `/${role}/dashboard`);
  await expect(page.locator(`a[href="${path}"][aria-current="page"]`).first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('h1:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function capture(page, name, options = {}) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.screenshot({ path: `${evidenceDirectory}/${name}.png`, fullPage: options.fullPage ?? true });
}

async function assertDesktopHeader(page, role) {
  const roleLabel = role === 'admin' ? 'Administrator' : role[0].toUpperCase() + role.slice(1);
  const nav = page.getByRole('navigation', { name: `${roleLabel} navigation` });
  const product = page.getByRole('link', { name: 'Research Topic Approval DSS home' });
  const account = page.getByTestId(`${role}-account`);
  const notifications = page.getByRole('button', { name: 'Open notifications' });
  const logout = page.getByTestId(`${role}-logout`);
  for (const locator of [product, nav, account, notifications, logout]) await expect(locator).toBeVisible();
  for (const link of await nav.getByRole('link').all()) {
    await expect(link).toBeVisible();
    expect(await link.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight;
    })).toBe(true);
  }
  const boxes = await Promise.all([product.boundingBox(), nav.boundingBox(), account.boundingBox(), notifications.boundingBox(), logout.boundingBox()]);
  expect(boxes.every(Boolean)).toBe(true);
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      expect(overlap(boxes[first], boxes[second])).toBe(false);
    }
  }
}

test.beforeEach(async ({ page }) => {
  const state = { consoleErrors: [], failedResponses: [], mutations: [], pageErrors: [] };
  observations.set(page, state);
  page.on('console', message => { if (message.type() === 'error') state.consoleErrors.push(message.text()); });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  page.on('request', request => {
    if (mutatingMethods.has(request.method())) {
      state.mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  page.on('response', response => {
    if (response.status() >= 400) state.failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(observations.get(page).consoleErrors).toEqual([]);
  expect(observations.get(page).pageErrors).toEqual([]);
  expect(observations.get(page).failedResponses).toEqual([]);
});

test('captures the complete Student workspace rollout', async ({ page }) => {
  await installMocks(page, 'student');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoute(page, '/student/dashboard', 'student', 'Student Dashboard');
  await assertDesktopHeader(page, 'student');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.locator('#main-content').evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  })).toBe(true);
  await page.locator('#main-content').evaluate(element => element.blur());
  await capture(page, '01-student-dashboard-desktop');

  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/student/dashboard', 'student', 'Student Dashboard');
  await capture(page, '02-student-dashboard-mobile');

  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/student/submit-topic', 'student', 'Submit Topic');
  await capture(page, '03-student-submit-default');
  await page.getByLabel(/research topic title/i).fill('Community health education approaches for improving maternal care participation outcomes');
  await page.getByLabel(/^category/i).fill('Public Health');
  await page.getByLabel(/^keywords/i).fill('maternal health, community education');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  expect(observations.get(page).mutations).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Before you submit' })).toBeVisible();
  await capture(page, '04-student-submit-confirmation');
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await expect(page.getByRole('heading', { name: 'Topic submitted for review' })).toBeVisible();
  expect(observations.get(page).mutations).toEqual(['POST /api/v1/submissions']);
  await capture(page, '05-student-submit-success');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoute(page, '/student/my-submissions', 'student', 'My Submissions');
  await capture(page, '06-student-submissions-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/student/my-submissions', 'student', 'My Submissions');
  await capture(page, '07-student-submissions-mobile');
  await openRoute(page, '/student/research-explorer', 'student', 'Research Explorer');
  await expect(page.getByLabel(/search approved topics/i)).toBeDisabled();
  await expect(page.getByLabel(/^category/i)).toBeDisabled();
  await capture(page, '08-student-explorer-mobile');

  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/student/check-my-topic', 'student', 'Check My Topic');
  await capture(page, '09-student-check-topic-regression');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
  await expect(page.getByText('Account and session')).toBeVisible();
  await capture(page, '10-student-mobile-menu');
});

test('captures the complete Lecturer workspace rollout', async ({ page }) => {
  await installMocks(page, 'lecturer');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoute(page, '/lecturer/dashboard', 'lecturer', 'Lecturer Dashboard');
  await assertDesktopHeader(page, 'lecturer');
  await expect(page.getByRole('navigation', { name: 'Lecturer navigation' }).getByRole('link')).toHaveCount(6);
  await capture(page, '11-lecturer-dashboard-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/lecturer/dashboard', 'lecturer', 'Lecturer Dashboard');
  await capture(page, '12-lecturer-dashboard-mobile');

  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/lecturer/pending-reviews', 'lecturer', 'Pending Reviews');
  await expect(page.getByRole('button', { name: 'Open Review' }).first()).toBeVisible();
  await capture(page, '13-lecturer-pending-reviews');
  await openRoute(page, '/lecturer/check-similarity', 'lecturer', 'Check Similarity');
  await capture(page, '14-lecturer-check-similarity');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/lecturer/my-decisions', 'lecturer', 'My Decisions');
  await capture(page, '15-lecturer-decisions-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/lecturer/supervisees', 'lecturer', 'Supervisees');
  await capture(page, '16-lecturer-supervisees');
  await openRoute(page, '/lecturer/research-trends', 'lecturer', 'Research Trends');
  await capture(page, '17-lecturer-research-trends');

  await page.goto('/lecturer/pending-reviews/42');
  await expect(page.getByRole('heading', { level: 1, name: 'Submission Details' })).toBeVisible();
  await capture(page, '18-lecturer-review-detail');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  expect(observations.get(page).mutations).toEqual([]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '19-lecturer-approve-confirmation', { fullPage: false });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Request Revision', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '20-lecturer-revision-confirmation', { fullPage: false });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByLabel(/decision rationale/i).fill('The study population and location require further definition.');
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  expect(observations.get(page).mutations).toEqual([]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '21-lecturer-reject-confirmation', { fullPage: false });
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText(/stored lecturer rationale/i)).toBeVisible();
  expect(observations.get(page).mutations).toEqual(['PATCH /api/v1/lecturer/submissions/42/status']);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, '22-lecturer-completed-decision');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
  await capture(page, '23-lecturer-mobile-menu');
});

test('captures the complete Administrator workspace rollout', async ({ page }) => {
  await installMocks(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoute(page, '/admin/dashboard', 'admin', 'Admin Dashboard');
  await assertDesktopHeader(page, 'admin');
  await expect(page.getByRole('navigation', { name: 'Administrator navigation' }).getByRole('link')).toHaveCount(6);
  await capture(page, '24-admin-dashboard');
  await openRoute(page, '/admin/user-management', 'admin', 'User Management');
  await capture(page, '25-admin-user-management');
  await page.getByRole('button', { name: 'Suspend account' }).first().click();
  expect(observations.get(page).mutations).toEqual([]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '26-admin-user-status-confirmation', { fullPage: false });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await openRoute(page, '/admin/topic-repository', 'admin', 'Topic Repository');
  await capture(page, '27-admin-topic-repository-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/admin/topic-repository', 'admin', 'Topic Repository');
  await capture(page, '28-admin-topic-repository-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId('topic-import-file-input').setInputFiles({ name: 'topics.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('deterministic spreadsheet fixture') });
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Preview complete')).toBeVisible();
  expect(observations.get(page).mutations).toEqual(['POST /api/v1/admin/import/topics/preview']);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, '29-admin-import-preview');
  await openRoute(page, '/admin/system-settings', 'admin', 'System Settings');
  await capture(page, '30-admin-system-settings');
  await openRoute(page, '/admin/audit-log', 'admin', 'Audit Log');
  await capture(page, '31-admin-audit-log');
  await page.getByRole('button', { name: 'Preview purge' }).click();
  await expect(page.getByText('Preview result')).toBeVisible();
  await page.getByLabel(/type CONFIRM_AUDIT_PURGE/i).fill('CONFIRM_AUDIT_PURGE');
  await expect(page.getByRole('button', { name: 'Purge old audit logs' })).toBeEnabled();
  expect(observations.get(page).mutations).toEqual([
    'POST /api/v1/admin/import/topics/preview',
    'POST /api/v1/admin/audit-logs/purge-preview'
  ]);
  await capture(page, '32-admin-purge-confirmation');
  await openRoute(page, '/admin/reports', 'admin', 'Reports');
  await capture(page, '33-admin-reports');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
  await capture(page, '34-admin-mobile-menu');
});

test('audits each authenticated shell at the tablet viewport', async ({ page }) => {
  const workspaces = [
    { role: 'student', path: '/student/dashboard', heading: 'Student Dashboard', evidence: '35-student-dashboard-tablet' },
    { role: 'lecturer', path: '/lecturer/dashboard', heading: 'Lecturer Dashboard', evidence: '36-lecturer-dashboard-tablet' },
    { role: 'admin', path: '/admin/dashboard', heading: 'Admin Dashboard', evidence: '37-admin-dashboard-tablet' }
  ];

  await page.setViewportSize({ width: 768, height: 1024 });
  for (const workspace of workspaces) {
    await page.unrouteAll({ behavior: 'wait' });
    await installMocks(page, workspace.role);
    await openRoute(page, workspace.path, workspace.role, workspace.heading);
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await capture(page, workspace.evidence);
  }
});
