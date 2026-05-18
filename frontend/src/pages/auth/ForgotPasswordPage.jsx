import { Link } from 'react-router-dom';

function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-950">Forgot password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Password reset email flow will be wired in the auth PR.
        </p>
        <input className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2" type="email" disabled />
        <button type="button" disabled className="mt-4 w-full rounded-md bg-gray-300 px-4 py-2 font-medium text-gray-600">
          Send reset link
        </button>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-emerald-700">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
