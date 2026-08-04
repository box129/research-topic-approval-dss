import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import AuthRecoveryLayout from '../../layouts/AuthRecoveryLayout';

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await forgotPassword({ email });
      setMessage(response.message || 'If that email exists, a password reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to request a reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthRecoveryLayout
      eyebrow="Password recovery"
      title="Forgot your password?"
      description="Enter your university email address and we will send a reset link if the account exists."
    >
      <InfoCallout
        className="mt-6"
        title="University account recovery"
        message="For privacy, the response does not confirm whether an account exists for the email address you submit."
      />

      {message && <InfoCallout className="mt-4" variant="success" message={message} />}
      {error && <InfoCallout className="mt-4" variant="danger" message={error} />}

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <TextInput
          id="forgot-password-email"
          label="University Email Address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          disabled={isSubmitting}
        />
        <PrimaryButton
          type="submit"
          disabled={isSubmitting}
          fullWidth
          className="auth-login-submit min-h-12"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </PrimaryButton>
      </form>

      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-gold-dark hover:text-brand-gold">
        Back to sign in
      </Link>
    </AuthRecoveryLayout>
  );
}

export default ForgotPasswordPage;
