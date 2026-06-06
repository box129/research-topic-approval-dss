import AdminDashboard from './admin/DashboardPage';
import AdminPlaceholderPage from './admin/PlaceholderPage';
import AdminSystemSettings from './admin/SystemSettingsPage';
import AdminTopicRepository from './admin/TopicRepositoryPage';
import AdminUserManagement from './admin/UserManagementPage';
import LecturerDashboard from './lecturer/DashboardPage';
import LecturerMyDecisions from './lecturer/MyDecisionsPage';
import PendingReviewsPage from './lecturer/PendingReviewsPage';
import LecturerResearchTrends from './lecturer/ResearchTrendsPage';
import SubmissionDetailPage from './lecturer/SubmissionDetailPage';
import LecturerSupervisees from './lecturer/SuperviseesPage';
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

export const LecturerMyDecisionsPage = LecturerMyDecisions;

export const LecturerSuperviseesPage = LecturerSupervisees;

export const LecturerResearchTrendsPage = LecturerResearchTrends;

export const StudentSubmitTopicPage = SubmitTopicPage;

export const StudentMySubmissionsPage = MySubmissionsPage;

export const StudentCheckMyTopicPage = CheckMyTopicPage;

export const StudentResearchExplorerPage = ResearchExplorerPage;

export const AdminUserManagementPage = AdminUserManagement;

export const AdminTopicRepositoryPage = AdminTopicRepository;

export const AdminSystemSettingsPage = AdminSystemSettings;

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
