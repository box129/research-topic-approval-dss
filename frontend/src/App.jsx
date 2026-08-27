import { Navigate, Route, Routes } from 'react-router-dom';
import PasswordChangeRoute from './auth/PasswordChangeRoute';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicAuthRoute from './auth/PublicAuthRoute';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AcceptInvitationPage from './pages/auth/AcceptInvitationPage';
import CheckSimilarityPage from './pages/lecturer/CheckSimilarityPage';
import {
  AdminAuditLogPage,
  AdminDashboardPage,
  AdminReportsPage,
  AdminSystemSettingsPage,
  AdminTopicRepositoryPage,
  AdminUserManagementPage,
  LecturerDashboardPage,
  LecturerMyDecisionsPage,
  LecturerPendingReviewsPage,
  LecturerResearchTrendsPage,
  LecturerReviewDecisionPage,
  LecturerSuperviseesPage,
  StudentCheckMyTopicPage,
  StudentDashboardPage,
  StudentMySubmissionsPage,
  StudentResearchExplorerPage,
  StudentSubmitTopicPage
} from './pages/rolePages';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={<PublicAuthRoute><LoginPage /></PublicAuthRoute>} />
      <Route path="/forgot-password" element={<PublicAuthRoute><ForgotPasswordPage /></PublicAuthRoute>} />
      <Route path="/reset-password" element={<PublicAuthRoute><ResetPasswordPage /></PublicAuthRoute>} />
      <Route path="/accept-invitation" element={<PublicAuthRoute><AcceptInvitationPage /></PublicAuthRoute>} />
      <Route path="/change-password" element={<PasswordChangeRoute><ChangePasswordPage /></PasswordChangeRoute>} />

      <Route path="/lecturer" element={<ProtectedRoute role="lecturer"><AppLayout role="lecturer" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/lecturer/dashboard" replace />} />
        <Route path="dashboard" element={<LecturerDashboardPage />} />
        <Route path="pending-reviews" element={<LecturerPendingReviewsPage />} />
        <Route path="pending-reviews/:topicId" element={<LecturerReviewDecisionPage />} />
        <Route path="check-similarity" element={<CheckSimilarityPage />} />
        <Route path="my-decisions" element={<LecturerMyDecisionsPage />} />
        <Route path="supervisees" element={<LecturerSuperviseesPage />} />
        <Route path="research-trends" element={<LecturerResearchTrendsPage />} />
      </Route>

      <Route path="/student" element={<ProtectedRoute role="student"><AppLayout role="student" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="submit-topic" element={<StudentSubmitTopicPage />} />
        <Route path="my-submissions" element={<StudentMySubmissionsPage />} />
        {/* Revising reuses the submission form so both paths share the same
            title rules, review-before-submit step and double-submit guard. */}
        <Route path="my-submissions/:submissionId/revise" element={<StudentSubmitTopicPage />} />
        <Route path="check-my-topic" element={<StudentCheckMyTopicPage />} />
        <Route path="research-explorer" element={<StudentResearchExplorerPage />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute role="admin"><AppLayout role="admin" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="user-management" element={<AdminUserManagementPage />} />
        <Route path="topic-repository" element={<AdminTopicRepositoryPage />} />
        <Route path="system-settings" element={<AdminSystemSettingsPage />} />
        <Route path="audit-log" element={<AdminAuditLogPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
