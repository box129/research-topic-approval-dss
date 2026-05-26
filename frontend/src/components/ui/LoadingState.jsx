import PropTypes from 'prop-types';
import LoadingStatePanel from './LoadingStatePanel';

function LoadingState({ label = 'Loading...' }) {
  return <LoadingStatePanel label={label} />;
}

LoadingState.propTypes = {
  label: PropTypes.string
};

export default LoadingState;
