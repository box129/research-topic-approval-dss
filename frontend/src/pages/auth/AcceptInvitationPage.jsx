import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import AuthRecoveryLayout from '../../layouts/AuthRecoveryLayout';

// After the token has been captured into component state it is removed from
// the address bar and browser history, so it cannot leak via history,
// shoulder-surfing, or the Referer of subsequent navigation. It is never
// written to localStorage, sessionStorage, or any analytics surface.
function scrubTokenFromLocation() {
  if (window.location.search) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

function AcceptInvitationPage() {
  const { acceptInvitation, validateInvitation } = useAuth();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') || '');
  const [validation, setValidation] = useState({ state: token ? 'checking' : 'missing', account: null });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const validatedRef = useRef(false);
  const hasMinimumLength = password.length >= 8;
  const hasNumber = /\d/.test(password);

  useEffect(() => {
    scrubTokenFromLocation();

    if (!token || validatedRef.current) {
      return;
    }
    validatedRef.current = true;

    validateInvitation({ token })
      .then((response) => {
        setValidation({ state: 'valid', account: response.data?.account || null });
      })
      .catch((err) => {
        setValidation({
          state: 'invalid',
          account: null,
          message: err.response?.data?.message || 'This invitation link is invalid or has expired.'
        });
      });
  }, [token, validateInvitation]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Success signs the user in; PublicAuthRoute then redirects to the
      // role dashboard automatically.
      await acceptInvitation({ token, password });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to activate the account with this link.');
      setIsSubmitting(false);
    }
  };

  const isFormReady = validation.state === 'valid';

  return (
    <AuthRecoveryLayout
      eyebrow="Account activation"
      title="Activate your account"
      description="Choose a private password for your provisioned university account."
    >
      {validation.state === 'missing' && (
        <InfoCallout
          className="mt-6"
          variant="warning"
          message="This activation link is incomplete. Open the full link from your invitation email, or ask an administrator to send a new invitation."
        />
      )}

      {validation.state === 'checking' && (
        <InfoCallout className="mt-6" message="Checking your invitation link..." />
      )}

      {validation.state === 'invalid' && (
        <InfoCallout
          className="mt-6"
          variant="warning"
          message={validation.message || 'This invitation link is invalid or has expired. Ask an administrator to send a new invitation.'}
        />
      )}

      {isFormReady && validation.account && (
        <InfoCallout
          className="mt-6"
          variant="success"
          title="Invitation verified"
          message={`Setting the password for ${validation.account.name} (${validation.account.email}).`}
        />
      )}

      {error && <InfoCallout className="mt-4" variant="danger" message={error} />}

      <div className="mt-6 rounded-card border border-border-subtle bg-[#f7fbf4] p-4">
        <p className="text-sm font-semibold text-text-primary">Password requirements</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className={hasMinimumLength ? 'font-medium text-feedback-success' : 'text-text-muted'}>
            {hasMinimumLength ? 'Complete:' : 'Required:'} at least 8 characters
          </li>
          <li className={hasNumber ? 'font-medium text-feedback-success' : 'text-text-muted'}>
            {hasNumber ? 'Complete:' : 'Required:'} at least one number
          </li>
        </ul>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <TextInput
          id="invitation-password"
          label="Choose a password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={!isFormReady || isSubmitting}
        />
        <TextInput
          id="invitation-password-confirmation"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={!isFormReady || isSubmitting}
        />
        <PrimaryButton
          type="submit"
          disabled={!isFormReady || isSubmitting}
          fullWidth
          className="auth-login-submit min-h-12"
        >
          {isSubmitting ? 'Activating...' : 'Set password and sign in'}
        </PrimaryButton>
      </form>

      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-gold-dark hover:text-brand-gold">
        Back to sign in
      </Link>
    </AuthRecoveryLayout>
  );
}

export default AcceptInvitationPage;
