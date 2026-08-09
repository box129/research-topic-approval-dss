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
    { label: 'Check My Topic', path: '/student/check-my-topic' },
    { label: 'Research Explorer', path: '/student/research-explorer' }
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
  },
  { label: 'Explore', items: [{ label: 'Research Explorer', path: '/student/research-explorer' }] }
];
