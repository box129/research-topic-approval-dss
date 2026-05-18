import { Link } from 'react-router-dom';

function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:grid-cols-[1fr_420px]">
        <section className="bg-emerald-700 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
            For Lecturers, Students and Administrators
          </p>
          <h1 className="mt-4 text-3xl font-bold">Research Topic Approval DSS</h1>
          <p className="mt-4 max-w-xl text-emerald-50">
            Sign in will route each user to the correct dashboard automatically once auth is implemented.
          </p>
        </section>

        <section className="p-8">
          <h2 className="text-2xl font-bold text-gray-950">Sign in</h2>
          <p className="mt-2 text-sm text-gray-600">Authentication is planned for the next PR.</p>

          <form className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" type="email" disabled />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" type="password" disabled />
            </label>
            <button type="button" disabled className="w-full rounded-md bg-gray-300 px-4 py-2 font-medium text-gray-600">
              Sign in
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="font-medium text-emerald-700 hover:text-emerald-800">
              Forgot password?
            </Link>
            <Link to="/lecturer/check-similarity" className="text-gray-600 hover:text-gray-950">
              MVP checker
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LoginPage;
