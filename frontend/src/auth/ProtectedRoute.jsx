import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingState from '../components/ui/LoadingState';
import { useAuth } from './AuthContext';
import { getDashboardPath } from './roleRoutes';

function ProtectedRoute({ children, role }) {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Checking session" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.oneOf(['admin', 'lecturer', 'student'])
};

export default ProtectedRoute;
