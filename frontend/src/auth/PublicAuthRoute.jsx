import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import LoadingState from '../components/ui/LoadingState';
import { useAuth } from './useAuth';
import { getDashboardPath } from './roleRoutes';

function PublicAuthRoute({ children }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingState label="Checking session" />;
  }

  if (user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
}

PublicAuthRoute.propTypes = {
  children: PropTypes.node.isRequired
};

export default PublicAuthRoute;
