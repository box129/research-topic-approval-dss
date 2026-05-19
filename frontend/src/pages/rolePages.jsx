import PlaceholderPage from './common/PlaceholderPage';
import V2PlaceholderPage from './common/V2PlaceholderPage';
import StatCard from '../components/ui/StatCard';
import PageHeader from '../components/ui/PageHeader';
import AlertBanner from '../components/ui/AlertBanner';
import PendingReviewsPage from './lecturer/PendingReviewsPage';
import SubmitTopicPage from './student/SubmitTopicPage';
import MySubmissionsPage from './student/MySubmissionsPage';

export function LecturerDashboardPage() {
  return (
    <>
      <PageHeader title="Lecturer Dashboard" subtitle="Review workload and quick actions will be connected in the lecturer workflow PR." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending Reviews" value="-" helper="Requires submissions workflow" />
        <StatCard label="Approved This Session" value="-" helper="Requires decision workflow" />
        <StatCard label="Rejected This Session" value="-" helper="Requires decision workflow" />
      </div>
      <div className="mt-6">
        <AlertBanner variant="info" message="This is the v1.0 route shell. Auth, submissions, and decisions are intentionally deferred." />
      </div>
    </>
  );
}

export function StudentDashboardPage() {
  return (
    <>
      <PageHeader title="Student Dashboard" subtitle="Student topic status and notifications will be connected in the student workflow PR." />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Active Topic" value="-" helper="No submission data connected yet" />
        <StatCard label="Notifications" value="-" helper="Mock email and notification service deferred" />
      </div>
    </>
  );
}

export function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="System health, activity, and usage metrics will be connected in the admin workflow PR." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="API" value="Ready" helper="Health endpoint exists" />
        <StatCard label="Database" value="-" helper="Health aggregation deferred" />
        <StatCard label="SBERT" value="-" helper="Health aggregation deferred" />
      </div>
    </>
  );
}

export const LecturerPendingReviewsPage = PendingReviewsPage;

export const LecturerReviewDecisionPage = () => (
  <PlaceholderPage title="Similarity Results and Decision" subtitle="L3 decision screen shell" />
);

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

export const StudentCheckMyTopicPage = () => (
  <PlaceholderPage title="Check My Topic" subtitle="St4 student pre-check shell" />
);

export const StudentResearchExplorerPage = () => (
  <V2PlaceholderPage title="Research Explorer" dashboardPath="/student/dashboard" />
);

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
