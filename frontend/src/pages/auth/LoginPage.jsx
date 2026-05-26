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
    <div className="flex h-full flex-col justify-between gap-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
          For Lecturers, Students and Administrators
        </p>
        <h1 className="mt-4 text-3xl font-bold">Research Topic Approval DSS</h1>
        <p className="mt-4 max-w-xl text-emerald-50">
          Sign in routes each user to the correct dashboard automatically.
        </p>
      </div>

      <div className="space-y-3 text-sm text-emerald-50">
        <p className="font-semibold text-white">Similarity-aware topic review</p>
        <ul className="space-y-2">
          <li>Submit, review, and track research topic decisions.</li>
          <li>Use one university account across student, lecturer, and admin portals.</li>
          <li>No role selector is needed; access follows your account role.</li>
        </ul>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout hero={heroContent}>
      <h2 className="text-2xl font-bold text-text-primary">Sign in</h2>
      <p className="mt-2 text-sm text-text-secondary">Sign in with your university account.</p>

      {error && (
        <InfoCallout
          className="mt-4"
          message={error}
          variant={getLoginErrorVariant(error)}
        />
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <TextInput
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          disabled={isSubmitting}
        />

        <TextInput
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />

        <PrimaryButton
          type="submit"
          fullWidth
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </PrimaryButton>
      </form>

      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <Link to="/forgot-password" className="font-medium text-brand-green hover:text-brand-green-dark">
          Forgot password?
        </Link>
        <span className="text-text-secondary">No role selector</span>
      </div>
    </AuthSplitLayout>
  );
}

export default LoginPage;
