import PropTypes from 'prop-types';
import EmptyStatePanel from './EmptyStatePanel';

function EmptyState({ title, message, action }) {
  return (
    <EmptyStatePanel title={title} message={message} action={action} />
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  action: PropTypes.node
};

export default EmptyState;
