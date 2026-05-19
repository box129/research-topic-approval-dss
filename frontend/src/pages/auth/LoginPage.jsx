import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardPath } from '../../auth/roleRoutes';

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

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:grid-cols-[1fr_420px]">
        <section className="bg-emerald-700 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
            For Lecturers, Students and Administrators
          </p>
          <h1 className="mt-4 text-3xl font-bold">Research Topic Approval DSS</h1>
          <p className="mt-4 max-w-xl text-emerald-50">
            Sign in routes each user to the correct dashboard automatically.
          </p>
        </section>

        <section className="p-8">
          <h2 className="text-2xl font-bold text-gray-950">Sign in</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in with your university account.</p>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-600"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="font-medium text-emerald-700 hover:text-emerald-800">
              Forgot password?
            </Link>
            <span className="text-gray-600">No role selector</span>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LoginPage;
