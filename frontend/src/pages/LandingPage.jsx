import { useNavigate } from 'react-router-dom';
import InfoCallout from '../components/ui/InfoCallout';
import PrimaryButton from '../components/ui/PrimaryButton';

const roles = [
  {
    title: 'Student',
    accent: 'S',
    helper: 'Submit, track, and pre-check topics.',
    items: ['Submit topic', 'Track status', 'Check similarity']
  },
  {
    title: 'Lecturer',
    accent: 'L',
    helper: 'Review topics with evidence.',
    items: ['Review queue', 'Inspect evidence', 'Record decision']
  },
  {
    title: 'Admin',
    accent: 'A',
    helper: 'Govern repository and oversight.',
    items: ['Topic records', 'Users and imports', 'Reports and audit']
  }
];

const workflowSteps = ['Topic Submission', 'Similarity Checking', 'Lecturer Review', 'Decision Evidence'];

const atAGlanceItems = [
  ['Frontend', 'Vercel staging'],
  ['API', 'Render backend'],
  ['Data', 'Neon PostgreSQL'],
  ['Semantic service', 'Hugging Face SBERT']
];

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#eef4eb] text-text-primary">
      <header className="border-b border-emerald-950/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-brand-green text-sm font-black text-white shadow-card">
              DSS
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">Research Topic Approval DSS</p>
              <p className="text-xs font-medium text-text-muted">Undergraduate topic review support</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-feedback-warning-border bg-feedback-warning-bg px-3 py-1 text-xs font-semibold text-feedback-warning sm:inline-flex">
              Staging demo
            </span>
            <PrimaryButton type="button" onClick={() => navigate('/login')}>
              Login
            </PrimaryButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-emerald-950/10">
        <div aria-hidden="true" className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-green-light/60 blur-3xl" />
        <div aria-hidden="true" className="absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-gold-light/50 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-12">
          <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#022c22,#064e3b)] p-7 text-white shadow-[0_24px_80px_-58px_rgb(6_95_70_/_0.7)] sm:p-9 lg:p-11">
            <div aria-hidden="true" className="absolute -right-28 -top-28 h-80 w-80 rounded-full border-[42px] border-white/5" />
            <div aria-hidden="true" className="absolute bottom-0 right-0 h-48 w-64 bg-white/5 blur-3xl" />

            <div className="relative z-10">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-50">
                Evidence-led topic approval
              </span>
              <h1 className="mt-7 max-w-2xl text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-[3.35rem]">
                Research Topic Approval DSS
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-emerald-100 sm:text-lg">
                Decision support for checking undergraduate research topic similarity before approval.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/80">
                A role-based front door for students submitting topics, lecturers reviewing evidence, and administrators managing the approval repository.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryButton
                  type="button"
                  className="auth-login-submit min-h-12 px-6"
                  onClick={() => navigate('/login')}
                >
                  Continue to Login
                </PrimaryButton>
                <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50">
                  Department account required
                </span>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {['Role-based access', 'Advisory similarity', 'Audited governance'].map((note) => (
                  <div key={note} className="rounded-[1rem] border border-white/10 bg-white/10 px-3 py-3 text-sm font-semibold text-emerald-50">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-[0_24px_70px_-52px_rgb(6_95_70_/_0.65)] sm:p-6 lg:p-7">
            <div className="flex h-full flex-col gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-green">System at a glance</p>
                <h2 className="mt-2 text-2xl font-bold text-text-primary">Live staging chain</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  The deployed demo route connects the frontend, backend, database, and semantic service without changing the application workflow.
                </p>
              </div>

              <div className="grid gap-3">
                {atAGlanceItems.map(([label, value]) => (
                  <div key={label} className="rounded-[1rem] border border-border-subtle bg-surface-page px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{label}</span>
                      <span className="rounded-full bg-feedback-success-bg px-2.5 py-1 text-[0.68rem] font-bold text-feedback-success">
                        Available
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto rounded-[1.25rem] border border-emerald-100 bg-[linear-gradient(135deg,#f7fff7,#fffaf0)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-green">Review workflow</p>
                <ol className="mt-4 space-y-3">
                  {workflowSteps.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-text-primary">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Role-based workflow</p>
            <h2 className="text-2xl font-bold text-text-primary">Choose the right workspace after login</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              The same entry point routes users to the correct student, lecturer, or administrator dashboard.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-border-subtle bg-white px-3 py-1 text-xs font-semibold text-text-secondary shadow-card">
            Role-aware access
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {roles.map((role) => (
            <article
              key={role.title}
              className="group rounded-[1.35rem] border border-emerald-100 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-brand-green-light text-base font-black text-brand-green-dark">
                  {role.accent}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{role.title}</p>
                  <h3 className="mt-1 text-base font-semibold leading-6 text-text-primary">{role.helper}</h3>
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
                {role.items.map((item) => (
                  <li key={item} className="rounded-full border border-border-subtle bg-surface-muted px-3 py-1">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-card">
          <div className="grid gap-0 lg:grid-cols-[0.36fr_0.64fr]">
            <div className="bg-[linear-gradient(145deg,#f7fff7,#fffaf0)] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Evidence flow</p>
              <h2 className="mt-2 text-xl font-bold text-text-primary">From proposal to decision record</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Similarity evidence supports review. It does not automatically approve or reject a student topic.
              </p>
              <span className="mt-4 inline-flex w-fit rounded-full bg-feedback-info-bg px-3 py-1 text-xs font-semibold text-feedback-info">
                Similarity remains advisory
              </span>
            </div>
            <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step}
                  className="relative rounded-[1rem] border border-border-subtle bg-white p-4 shadow-sm"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-bold leading-5 text-text-primary">{step}</h3>
                  {index < workflowSteps.length - 1 && (
                    <span aria-hidden="true" className="absolute right-4 top-5 hidden text-lg font-bold text-brand-gold lg:block">
                      -&gt;
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <InfoCallout
          title="Staging/demo notice"
          message="This deployment is for FYP/demo staging evidence. It does not claim final public production readiness, completed lecturer validation, SMTP provider proof, or departmental approval."
          variant="warning"
        />
      </section>
    </main>
  );
}

export default LandingPage;
