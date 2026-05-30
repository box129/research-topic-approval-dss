import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardPath } from '../../auth/roleRoutes';
import InfoCallout from '../../components/ui/InfoCallout';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TextInput from '../../components/ui/TextInput';
import AuthSplitLayout from '../../layouts/AuthSplitLayout';

function getLoginErrorVariant(message) {
  const normalizedMessage = String(message || '').toLowerCase();
  return normalizedMessage.includes('locked') || normalizedMessage.includes('disabled') ? 'warning' : 'danger';
}

function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
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

  const heroContent = (
    <div className="flex h-full min-h-[420px] flex-col justify-between gap-12">
      <div>
        <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-50">
          UNIOSUN Public Health
        </p>
        <h1 className="mt-8 max-w-lg text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
          Research Topic{' '}
          <span className="block font-serif italic text-brand-gold-light">Similarity</span>
          Detection System
        </h1>
        <p className="mt-8 max-w-md text-base leading-7 text-emerald-100">
          Preventing duplicate research topics across the Public Health Department through advanced
          linguistic analysis and repository cross-referencing.
        </p>
      </div>

      <div className="space-y-9">
        <ul className="space-y-4 text-sm font-medium text-emerald-50">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Tri-algorithm similarity detection</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Three-tier historical comparison</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Role-based topic approval workflows</span>
          </li>
        </ul>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-emerald-100/70">
          Osun State University &copy; 2026
        </p>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout hero={heroContent}>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand-gold-dark">
        For Lecturers, Students and Administrators
      </p>
      <h2 className="mt-4 text-3xl font-bold text-text-primary">Welcome back</h2>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        Sign in with your university account. Access follows your assigned role automatically.
      </p>

      {error && (
        <InfoCallout
          className="mt-6"
          message={error}
          variant={getLoginErrorVariant(error)}
        />
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <TextInput
          id="login-email"
          label="University Email Address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
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

      <div className="mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-brand-gold-dark">
          Contact your department administrator for account access.
        </span>
        <span className="text-text-secondary">No role selector</span>
      </div>
    </AuthSplitLayout>
  );
}

export default LoginPage;
