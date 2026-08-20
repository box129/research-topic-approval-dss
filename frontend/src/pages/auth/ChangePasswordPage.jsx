import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { getDashboardPath } from '../../auth/roleRoutes';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import AuthRecoveryLayout from '../../layouts/AuthRecoveryLayout';

function ChangePasswordPage() {
  const { changePassword, logout, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasMinimumLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const isForcedChange = Boolean(user?.mustChangePassword);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await changePassword({ currentPassword, newPassword });
      const nextUser = response?.data?.user;
      navigate(getDashboardPath(nextUser?.role || user?.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthRecoveryLayout
      eyebrow={isForcedChange ? 'First access' : 'Account security'}
      title={isForcedChange ? 'Set your own password' : 'Change your password'}
      description={isForcedChange
        ? 'Your account was issued a temporary password. Choose a private password to activate normal access.'
        : 'Confirm your current password, then choose a new one.'}
    >
      {isForcedChange && (
        <InfoCallout
          className="mt-6"
          variant="warning"
          message="Your temporary password only allows this step. All other pages stay locked until you set a private password."
        />
      )}
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
          id="change-current-password"
          label={isForcedChange ? 'Temporary password' : 'Current password'}
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
        <TextInput
          id="change-new-password"
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
        <TextInput
          id="change-confirm-password"
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
        <PrimaryButton
          type="submit"
          disabled={isSubmitting}
          fullWidth
          className="auth-login-submit min-h-12"
        >
          {isSubmitting ? 'Saving...' : 'Set password'}
        </PrimaryButton>
      </form>

      <button
        className="mt-6 inline-block text-sm font-semibold text-brand-gold-dark hover:text-brand-gold"
        onClick={handleSignOut}
        type="button"
      >
        Sign out instead
      </button>
    </AuthRecoveryLayout>
  );
}

export default ChangePasswordPage;
