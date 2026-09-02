import { useEffect, useId, useRef } from 'react';
import PropTypes from 'prop-types';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

// Non-default variants override PrimaryButton's base background. The
// important modifier makes the override independent of generated-CSS order —
// without it the variant and the base both land in the class attribute and
// the winner is stylesheet luck.
const VARIANT_CLASSES = {
  default: 'bg-brand-green hover:bg-brand-green-dark',
  danger: 'bg-feedback-danger! hover:bg-red-800!',
  // Confirming a revision request is a revision action, not an approval, so
  // the confirm control carries amber/revision semantics rather than
  // inheriting the approve-green default (audit N-4 / frozen Board B).
  revision: 'bg-brand-gold-dark! hover:bg-amber-800!'
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
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const isConfirmingRef = useRef(isConfirming);
  const onCancelRef = useRef(onCancel);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    isConfirmingRef.current = isConfirming;
    onCancelRef.current = onCancel;
  }, [isConfirming, onCancel]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isConfirmingRef.current) onCancelRef.current();
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )];
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const previous = previouslyFocusedRef.current;
      if (previous?.isConnected) previous.focus();
      else document.getElementById('main-content')?.focus();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6" role="presentation">
      <section
        ref={dialogRef}
        aria-describedby={message ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-card border border-border-subtle bg-white p-6 shadow-modal"
        role="dialog"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
        {message && <p id={descriptionId} className="mt-2 text-sm text-text-secondary">{message}</p>}
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
  variant: PropTypes.oneOf(['default', 'danger', 'revision'])
};

export default ConfirmActionModal;
