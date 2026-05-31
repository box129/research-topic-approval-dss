import PlaceholderPage from './common/PlaceholderPage';
import V2PlaceholderPage from './common/V2PlaceholderPage';
import AdminDashboard from './admin/DashboardPage';
import AdminPlaceholderPage from './admin/PlaceholderPage';
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
  <AdminPlaceholderPage
    title="User Management"
    subtitle="Protected admin workspace for future account and role administration"
    message="Account provisioning, role updates, and user records remain unavailable until a safe admin API and scoped workflow are approved."
  />
);

export const AdminTopicRepositoryPage = () => (
  <AdminPlaceholderPage
    title="Topic Repository"
    subtitle="Protected admin workspace for future repository oversight"
    message="Repository browsing, import controls, and topic administration remain unavailable until the real API behavior is defined and connected."
  />
);

export const AdminSystemSettingsPage = () => (
  <AdminPlaceholderPage
    title="System Settings"
    subtitle="Protected admin workspace for future configuration controls"
    message="Configuration values and update actions remain unavailable until supported settings contracts and validation rules exist."
  />
);

export const AdminAuditLogPage = () => (
  <AdminPlaceholderPage
    title="Audit Log"
    subtitle="Protected admin workspace for future audit visibility"
    message="Audit records and filtering remain unavailable until a real audit API is connected. No activity entries are fabricated here."
  />
);

export const AdminReportsPage = () => (
  <AdminPlaceholderPage
    dashboardPath="/admin/dashboard"
    title="Reports"
    subtitle="Protected admin workspace for future reporting"
    message="Reports, analytics, and exports remain unavailable until real data sources and approved reporting behavior are connected."
  />
);
