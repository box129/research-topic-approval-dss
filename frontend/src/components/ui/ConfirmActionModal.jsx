import PropTypes from 'prop-types';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

const VARIANT_CLASSES = {
  default: 'bg-brand-green hover:bg-brand-green-dark',
  danger: 'bg-feedback-danger hover:bg-red-800'
};

function ConfirmActionModal({
  cancelLabel = 'Cancel',
  children,
  confirmLabel = 'Confirm',
  isConfirming = false,
  isOpen = false,
  message,
  onCancel,
  onConfirm,
  title,
  variant = 'default'
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6" role="presentation">
      <section
        aria-modal="true"
        className="w-full max-w-md rounded-card border border-border-subtle bg-white p-6 shadow-modal"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {message && <p className="mt-2 text-sm text-text-secondary">{message}</p>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton type="button" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            isLoading={isConfirming}
            className={VARIANT_CLASSES[variant] || VARIANT_CLASSES.default}
          >
            {confirmLabel}
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
}

ConfirmActionModal.propTypes = {
  cancelLabel: PropTypes.string,
  children: PropTypes.node,
  confirmLabel: PropTypes.string,
  isConfirming: PropTypes.bool,
  isOpen: PropTypes.bool,
  message: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['default', 'danger'])
};

export default ConfirmActionModal;
