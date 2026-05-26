import PlaceholderPage from './common/PlaceholderPage';
import V2PlaceholderPage from './common/V2PlaceholderPage';
import AdminDashboard from './admin/DashboardPage';
import LecturerDashboard from './lecturer/DashboardPage';
import PendingReviewsPage from './lecturer/PendingReviewsPage';
import SubmissionDetailPage from './lecturer/SubmissionDetailPage';
import DashboardPage from './student/DashboardPage';
import SubmitTopicPage from './student/SubmitTopicPage';
import MySubmissionsPage from './student/MySubmissionsPage';
import CheckMyTopicPage from './student/CheckMyTopicPage';
import ResearchExplorerPage from './student/ResearchExplorerPage';

export const LecturerDashboardPage = LecturerDashboard;

export const StudentDashboardPage = DashboardPage;

export const AdminDashboardPage = AdminDashboard;

export const LecturerPendingReviewsPage = PendingReviewsPage;

export const LecturerReviewDecisionPage = SubmissionDetailPage;

export const LecturerMyDecisionsPage = () => (
  <PlaceholderPage title="My Decisions" subtitle="L4 decision history shell" />
);

export const LecturerSuperviseesPage = () => (
  <PlaceholderPage title="Supervisees" subtitle="L6 supervisee overview shell" />
);

export const LecturerResearchTrendsPage = () => (
  <V2PlaceholderPage title="Research Trends" dashboardPath="/lecturer/dashboard" />
);

export const StudentSubmitTopicPage = SubmitTopicPage;

export const StudentMySubmissionsPage = MySubmissionsPage;

export const StudentCheckMyTopicPage = CheckMyTopicPage;

export const StudentResearchExplorerPage = ResearchExplorerPage;

export const AdminUserManagementPage = () => (
  <PlaceholderPage title="User Management" subtitle="A2 user management shell" />
);

export const AdminTopicRepositoryPage = () => (
  <PlaceholderPage title="Topic Repository" subtitle="A3 import and topic repository shell" />
);

export const AdminSystemSettingsPage = () => (
  <PlaceholderPage title="System Settings" subtitle="A4 configuration shell" />
);

export const AdminAuditLogPage = () => (
  <PlaceholderPage title="Audit Log" subtitle="A5 audit log shell" />
);

export const AdminReportsPage = () => (
  <V2PlaceholderPage title="Reports" dashboardPath="/admin/dashboard" />
);
