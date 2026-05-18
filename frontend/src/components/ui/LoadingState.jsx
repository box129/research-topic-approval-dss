import PropTypes from 'prop-types';

function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        {label}
      </div>
    </div>
  );
}

LoadingState.propTypes = {
  label: PropTypes.string
};

export default LoadingState;
