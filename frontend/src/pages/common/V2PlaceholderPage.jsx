import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

function V2PlaceholderPage({ title, dashboardPath }) {
  return (
    <>
      <PageHeader title={title} subtitle="v2.0 placeholder" />
      <EmptyState
        title={`${title} will be available after the first approval session`}
        message="This analytics feature is designed, but intentionally deferred until v1.0 is stable and enough real topic data has been collected."
        action={(
          <Link to={dashboardPath} className="inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Back to Dashboard
          </Link>
        )}
      />
    </>
  );
}

V2PlaceholderPage.propTypes = {
  title: PropTypes.string.isRequired,
  dashboardPath: PropTypes.string.isRequired
};

export default V2PlaceholderPage;
