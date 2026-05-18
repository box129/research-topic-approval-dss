import { Link } from 'react-router-dom';

function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-950">Reset password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Token validation and password update will be implemented with cookie-based auth.
        </p>
        <input className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2" type="password" disabled />
        <input className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2" type="password" disabled />
        <button type="button" disabled className="mt-4 w-full rounded-md bg-gray-300 px-4 py-2 font-medium text-gray-600">
          Set new password
        </button>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-emerald-700">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
