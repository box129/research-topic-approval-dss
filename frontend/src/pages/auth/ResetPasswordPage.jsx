import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import AuthRecoveryLayout from '../../layouts/AuthRecoveryLayout';

function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get('token') || '';
  const hasMinimumLength = password.length >= 8;
  const hasNumber = /\d/.test(password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword({ token, password });
      setMessage(response.message || 'Password has been reset.');
      setTimeout(() => navigate('/login', { replace: true }), 600);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthRecoveryLayout
      eyebrow="Password recovery"
      title="Set a new password"
      description="Create a strong password for your university account. The existing reset workflow validates the final request."
    >
      {!token && (
        <InfoCallout
          className="mt-6"
          variant="warning"
          message="Reset token is missing. Request a new link to continue."
        />
      )}
      {message && <InfoCallout className="mt-6" variant="success" message={message} />}
      {error && <InfoCallout className="mt-6" variant="danger" message={error} />}

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
          id="reset-password"
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={!token}
        />
        <TextInput
          id="reset-password-confirmation"
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={!token}
        />
        <PrimaryButton
          type="submit"
          disabled={!token || isSubmitting}
          fullWidth
          className="auth-login-submit min-h-12"
        >
          {isSubmitting ? 'Resetting...' : 'Set new password'}
        </PrimaryButton>
      </form>

      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-gold-dark hover:text-brand-gold">
        Back to sign in
      </Link>
    </AuthRecoveryLayout>
  );
}

export default ResetPasswordPage;
