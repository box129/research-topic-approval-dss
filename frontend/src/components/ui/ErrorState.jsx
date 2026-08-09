import PropTypes from 'prop-types';
import SecondaryButton from './SecondaryButton';

function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div role="alert" className="rounded-card border border-feedback-danger-border bg-feedback-danger-bg p-6 shadow-card">
      <h2 className="font-semibold text-feedback-danger">{title}</h2>
      {message && <p className="mt-2 text-sm text-feedback-danger">{message}</p>}
      {onRetry && (
        <SecondaryButton
          type="button"
          onClick={onRetry}
          className="mt-4 border-feedback-danger-border text-feedback-danger hover:bg-red-50"
        >
          Try again
        </SecondaryButton>
      )}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onRetry: PropTypes.func
};

export default ErrorState;
