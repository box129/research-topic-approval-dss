import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { getDashboardPath } from '../../auth/roleRoutes';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import PublicAuthLayout from '../../layouts/PublicAuthLayout';

function getLoginErrorVariant(message) {
  const normalizedMessage = String(message || '').toLowerCase();
  return normalizedMessage.includes('locked') || normalizedMessage.includes('disabled') ? 'warning' : 'danger';
}

function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await login({ identifier, password });
      if (user?.mustChangePassword) {
        // Temporary credential: the account must establish a private password
        // before any normal navigation. The backend blocks other APIs too.
        navigate('/change-password', { replace: true });
        return;
      }
      const dashboardPath = getDashboardPath(user?.role);
      const requestedPath = location.state?.from;
      const safeRequestedPath = requestedPath?.startsWith(`/${user?.role}/`) ? requestedPath : null;
      navigate(safeRequestedPath || dashboardPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in with those credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <PublicAuthLayout>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand-gold-dark">
        For Lecturers, Students and Administrators
      </p>
      <h1 className="mt-3 text-[1.625rem] font-bold text-text-primary">Welcome back</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        Sign in with your account. Access follows your assigned role automatically.
      </p>

      {error && (
        <InfoCallout
          className="mt-6"
          message={error}
          variant={getLoginErrorVariant(error)}
        />
      )}

      <form className="mt-[1.375rem] space-y-4" onSubmit={handleSubmit}>
        <TextInput
          id="login-identifier"
          label="Email Address or Matric Number"
          // Deliberately not type="email": a matric number is a valid entry
          // here and browser email validation would reject it outright.
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          helperText="Students can sign in with their matric number. Lecturers and administrators use their email address."
          required
          disabled={isSubmitting}
          className={error ? 'border-feedback-danger focus:border-feedback-danger focus:ring-feedback-danger/20' : ''}
        />

        <TextInput
          id="login-password"
          label="Secure Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
          className={error ? 'border-feedback-danger focus:border-feedback-danger focus:ring-feedback-danger/20' : ''}
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-gold-dark hover:text-brand-gold">
            Forgot password?
          </Link>
        </div>

        <PrimaryButton
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          className="auth-login-submit min-h-12"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </PrimaryButton>
      </form>

    </PublicAuthLayout>
  );
}

export default LoginPage;
