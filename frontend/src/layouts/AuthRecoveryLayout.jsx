import PropTypes from 'prop-types';
import AuthSplitLayout from './AuthSplitLayout';

function AuthRecoveryLayout({ children, description, eyebrow, title }) {
  const heroContent = (
    <div className="flex h-full min-h-[380px] flex-col justify-between gap-12">
      <div>
        <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-50">
          UNIOSUN Public Health
        </p>
        <h2 className="mt-8 max-w-md text-4xl font-bold leading-tight sm:text-5xl">
          Secure account{' '}
          <span className="block font-serif italic text-brand-gold-light">recovery</span>
        </h2>
        <p className="mt-7 max-w-md text-base leading-7 text-emerald-100">
          Restore access to the Research Topic Similarity Detection System through the existing
          university account recovery flow.
        </p>
      </div>

      <div className="space-y-8">
        <ul className="space-y-4 text-sm font-medium text-emerald-50">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Use the email address attached to your DSS account</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Reset links are handled by the existing protected workflow</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
            <span>Return to sign in after updating your password</span>
          </li>
        </ul>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-emerald-100/70">
          Osun State University
        </p>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout hero={heroContent}>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand-gold-dark">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{description}</p>
      {children}
    </AuthSplitLayout>
  );
}

AuthRecoveryLayout.propTypes = {
  children: PropTypes.node.isRequired,
  description: PropTypes.string.isRequired,
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};

export default AuthRecoveryLayout;
