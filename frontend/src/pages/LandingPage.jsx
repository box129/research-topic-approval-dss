import { useNavigate } from 'react-router-dom';
import InfoCallout from '../components/ui/InfoCallout';
import PrimaryButton from '../components/ui/PrimaryButton';
import SecondaryButton from '../components/ui/SecondaryButton';

const roles = [
  {
    title: 'Student',
    helper: 'Submit topic, track submission, check similarity.',
    items: ['Topic submission', 'Submission status', 'Similarity pre-check']
  },
  {
    title: 'Lecturer',
    helper: 'Review assigned topics, inspect similarity evidence, make approval decisions.',
    items: ['Pending review queue', 'Similarity evidence', 'Approval decisions']
  },
  {
    title: 'Admin',
    helper: 'Manage topic records, users, imports, reports, and oversight.',
    items: ['Topic repository', 'User and import governance', 'Reports and audit oversight']
  }
];

const workflowSteps = [
  {
    title: 'Submit or review a topic',
    description: 'Students submit proposed topics while lecturers work through controlled review queues.'
  },
  {
    title: 'Compare with existing topics',
    description: 'The system checks against stored topic records and saved similarity evidence where available.'
  },
  {
    title: 'Decide with evidence',
    description: 'Lecturers make approval, rejection, or revision decisions without treating similarity as an automatic verdict.'
  }
];

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-surface-page text-text-primary">
      <section className="border-b border-emerald-950/10 bg-[#eef4eb]">
        <div className="mx-auto grid min-h-[620px] max-w-6xl gap-0 px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-10">
          <div className="relative overflow-hidden rounded-t-[2rem] bg-[linear-gradient(150deg,#022c22,#064e3b)] p-8 text-white shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)] sm:p-10 lg:rounded-l-[2rem] lg:rounded-tr-none lg:p-12">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[42px] border-white/5" />
            <div aria-hidden="true" className="absolute right-0 top-0 h-48 w-64 bg-white/5 blur-3xl" />

            <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-between gap-12">
              <div>
                <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-50">
                  Research approval support
                </p>
                <h1 className="mt-8 max-w-xl text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
                  Research Topic Approval DSS
                </h1>
                <p className="mt-6 max-w-md text-base leading-7 text-emerald-100">
                  Decision support for checking undergraduate research topic similarity before approval.
                </p>
              </div>

              <div className="space-y-5">
                <ul className="space-y-4 text-sm font-medium text-emerald-50">
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
                    <span>Students submit and monitor topic decisions.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
                    <span>Lecturers review topics with similarity evidence.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-light" />
                    <span>Administrators manage repository and oversight workflows.</span>
                  </li>
                </ul>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-emerald-100/70">
                  Staging/demo system
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-b-[2rem] border border-emerald-950/10 bg-white p-6 shadow-card sm:p-8 lg:rounded-r-[2rem] lg:rounded-bl-none lg:p-10">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-green">
                  System entry
                </p>
                <h2 className="mt-3 text-2xl font-bold text-text-primary sm:text-3xl">
                  One front door for students, lecturers, and administrators.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
                  Use your assigned university account to continue. Access is role-based, so the same login flow routes each user to the correct dashboard.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PrimaryButton
                  type="button"
                  className="min-h-12"
                  onClick={() => navigate('/login')}
                >
                  Continue to Login
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  className="min-h-12"
                  onClick={() => navigate('/login')}
                >
                  Department Account Required
                </SecondaryButton>
              </div>

              <InfoCallout
                title="Staging/demo notice"
                message="This deployment is for FYP/demo staging evidence. It does not claim final public production readiness, completed lecturer validation, or departmental approval."
                variant="warning"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Role-based workflow</p>
            <h2 className="text-2xl font-bold text-text-primary">Designed around the current DSS roles</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              The landing page describes existing system surfaces without inventing users, analytics, or production claims.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-border-subtle bg-white px-3 py-1 text-xs font-semibold text-text-secondary shadow-card">
            No fake data
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {roles.map((role) => (
            <article
              key={role.title}
              className="rounded-[1.35rem] border border-emerald-100 bg-white p-5 shadow-card"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{role.title}</p>
              <h3 className="mt-3 text-lg font-semibold text-text-primary">{role.helper}</h3>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-text-secondary">
                {role.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-[1.75rem] border border-border-subtle bg-white p-5 shadow-card sm:p-7">
          <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">How it works</p>
              <h2 className="text-xl font-bold text-text-primary">Evidence-led topic review</h2>
            </div>
            <span className="inline-flex w-fit rounded-full bg-feedback-info-bg px-3 py-1 text-xs font-semibold text-feedback-info">
              Similarity remains advisory
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[1.15rem] border border-border-subtle border-l-4 border-l-brand-green bg-white p-4 shadow-sm"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-green-light text-sm font-bold text-brand-green-dark">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
