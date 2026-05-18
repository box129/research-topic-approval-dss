import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-950">Forgot password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email address and we will send a reset link if the account exists.
        </p>
        {message && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-600"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-emerald-700">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
