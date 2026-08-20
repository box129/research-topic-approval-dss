import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import LoadingState from '../components/ui/LoadingState';
import { useAuth } from './useAuth';

// Guard for the password-establishment screen: requires an authenticated
// session but, unlike ProtectedRoute, does not redirect users who still have
// a pending forced password change — this is the one screen they may use.
function PasswordChangeRoute({ children }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingState label="Checking session" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

PasswordChangeRoute.propTypes = {
  children: PropTypes.node.isRequired
};

export default PasswordChangeRoute;
