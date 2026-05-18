export const roleDashboardPaths = {
  admin: '/admin/dashboard',
  lecturer: '/lecturer/dashboard',
  student: '/student/dashboard'
};

export function getDashboardPath(role) {
  return roleDashboardPaths[role] || '/login';
}
