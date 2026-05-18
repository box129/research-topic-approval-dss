import PropTypes from 'prop-types';

function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      {message && <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  action: PropTypes.node
};

export default EmptyState;
