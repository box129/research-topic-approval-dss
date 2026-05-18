import PropTypes from 'prop-types';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

function PlaceholderPage({ title, subtitle, message }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title={`${title} is ready for v1.0 implementation`}
        message={message || 'This route is part of the role-based shell. Business logic will be added in a later vertical workflow PR.'}
      />
    </>
  );
}

PlaceholderPage.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  message: PropTypes.string
};

export default PlaceholderPage;
