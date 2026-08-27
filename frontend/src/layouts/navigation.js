// DEFERRED FOR THE PILOT: the Research Explorer page is still a placeholder
// (a disabled search box and an honest "not currently available" message), so
// advertising it in navigation would promise a capability the pilot does not
// have. The route and the page are intentionally kept so the feature can be
// built later; only the navigation entry is withheld. Re-enable by adding this
// entry back to `roleNavigation.student` and restoring the "Explore" group in
// `studentCheckerNavigationGroups` once the page actually browses approved
// topics. See docs/product/usability-audit.md (Part K).
export const deferredStudentNavigation = [
  { label: 'Research Explorer', path: '/student/research-explorer' }
];

export const roleNavigation = {
  lecturer: [
    { label: 'Dashboard', path: '/lecturer/dashboard' },
    { label: 'Pending Reviews', path: '/lecturer/pending-reviews' },
    { label: 'Check Similarity', path: '/lecturer/check-similarity' },
    { label: 'My Decisions', path: '/lecturer/my-decisions' },
    { label: 'Supervisees', path: '/lecturer/supervisees' },
    { label: 'Research Trends', path: '/lecturer/research-trends' }
  ],
  student: [
    { label: 'Dashboard', path: '/student/dashboard' },
    { label: 'Submit Topic', path: '/student/submit-topic' },
    { label: 'My Submissions', path: '/student/my-submissions' },
    { label: 'Check My Topic', path: '/student/check-my-topic' }
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'User Management', path: '/admin/user-management' },
    { label: 'Topic Repository', path: '/admin/topic-repository' },
    { label: 'System Settings', path: '/admin/system-settings' },
    { label: 'Audit Log', path: '/admin/audit-log' },
    { label: 'Reports', path: '/admin/reports' }
  ]
};

export const roleLabels = {
  lecturer: 'Lecturer',
  student: 'Student',
  admin: 'Administrator'
};

export const studentCheckerHomePath = '/student/dashboard';

export const studentCheckerNavigationGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', path: studentCheckerHomePath }] },
  {
    label: 'Topic workflow',
    items: [
      { label: 'Check My Topic', path: '/student/check-my-topic' },
      { label: 'Submit Topic', path: '/student/submit-topic' },
      { label: 'My Submissions', path: '/student/my-submissions' }
    ]
  }
];
