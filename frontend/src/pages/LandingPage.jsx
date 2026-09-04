import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import '@fontsource-variable/geist';
import './LandingPage.css';

/*
Approved landing target — Candidate 3a (Final candidate: refined 2b, finishing
alternative 3a, Geist-only). Composition, copy, geometry and rhythm follow the
frozen landing boards ("Final Candidate - Refined 2b" + "Finishing Alternatives
+ Supersessions"); product-proof content is reconciled to the CURRENT merged
product truth (Board A neutral similarity classification with subordinate raw
cosine, Board B decision record with terminal controls removed, matric-first
student identity, Voyage-only semantic contract, staging honesty).
*/

const PROOF_DISCLAIMER = 'Illustrative product preview — synthetic records, not departmental data.';

function AnchorLink({ id, children, className = '', ariaLabel }) {
  const location = useLocation();

  const handleClick = (event) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    window.history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  };

  return <a aria-label={ariaLabel} className={className} href={`#${id}`} onClick={handleClick}>{children}</a>;
}

AnchorLink.propTypes = {
  ariaLabel: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  id: PropTypes.string.isRequired
};

/* 68px masthead band + 44px index rule. The index rule is the one staging
   notice: environment · function · build, factual institutional metadata. */
function Masthead() {
  return (
    <header className="rl-header" data-testid="landing-masthead">
      <div className="rl-shell rl-header__band">
        <AnchorLink id="top" className="rl-brand" ariaLabel="Research Topic Approval DSS home">
          <span className="rl-brand__mark" aria-hidden="true">U</span>
          <span className="rl-brand__text">
            <strong>Research Topic Approval DSS</strong>
            <small>UNIOSUN · Department of Public Health</small>
          </span>
        </AnchorLink>
        <nav className="rl-nav" aria-label="Landing page">
          <AnchorLink id="how-it-works">How it works</AnchorLink>
          <AnchorLink id="evidence">Evidence</AnchorLink>
          <AnchorLink id="access">Access</AnchorLink>
          <Link className="rl-nav__signin" to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="rl-shell rl-header__index">
        <span>Pre-pilot · staging environment</span>
        <span className="rl-header__index-fn">Semantic topic comparison</span>
        <span className="rl-header__index-release">Pre-pilot build</span>
      </div>
    </header>
  );
}

/* Product-proof window chrome: dots, product lockup, path, identity. */
function WindowChrome({ path, name, meta, initials, role }) {
  return (
    <div className="rl-window__chrome" aria-hidden="true">
      <span className="rl-window__dots"><i /><i /><i /></span>
      <span className="rl-window__app"><b>U</b> Research Topic Approval</span>
      <span className="rl-window__path">{path}</span>
      <span className="rl-window__id">
        <span className="rl-window__idtext">{name}{meta ? <small>{meta}</small> : null}</span>
        <span className="rl-window__avatar">{initials}</span>
        <small className="rl-window__role">{role}</small>
      </span>
    </div>
  );
}

WindowChrome.propTypes = {
  initials: PropTypes.string.isRequired,
  meta: PropTypes.string,
  name: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired
};

function StateCaption({ state, children }) {
  return (
    <figcaption className="rl-caption">
      <span className="rl-caption__label">State {state} of 3</span>
      <span className="rl-caption__text">{children}</span>
    </figcaption>
  );
}

StateCaption.propTypes = {
  children: PropTypes.node.isRequired,
  state: PropTypes.string.isRequired
};

/* State 1 — the student pre-check, rendered to current Board A truth:
   neutral classification language, no verdict colour, advisory boundary. */
function StateOneWindow() {
  return (
    <figure className="rl-window rl-window--hero" aria-label="Product preview: student topic check">
      <WindowChrome
        path="/student/check-my-topic"
        name="Adaeze Example"
        meta="PH/2021/0412"
        initials="AE"
        role="Student"
      />
      <div className="rl-window__body">
        <div className="rl-proof__head">
          <span className="rl-proof__crumb">Check My Topic</span>
          <span className="rl-proof__pill rl-proof__pill--advisory">Advisory · not saved</span>
        </div>
        <p className="rl-proof__result">3 related records found</p>
        <p className="rl-proof__lede">Related work exists on file. Compare its context before submitting.</p>
        <p className="rl-proof__checked"><small>Checked</small>Knowledge and practice of malaria prevention among mothers of under-five children in Osogbo</p>
        <ul className="rl-proof__records">
          <li>
            <div>
              <p>Assessment of malaria prevention practices among caregivers of under-five children in Olorunda LGA</p>
              <small>2022/2023 session · Dr F. A. Adewale · Historical record</small>
            </div>
            <span className="rl-class rl-class--higher">Higher similarity</span>
          </li>
          <li>
            <div>
              <p>Determinants of insecticide-treated net use in rural households of Osun State</p>
              <small>2021/2022 session · Dr K. O. Balogun · Historical record</small>
            </div>
            <span className="rl-class rl-class--moderate">Moderate similarity</span>
          </li>
          <li>
            <div>
              <p>Health education and uptake of intermittent preventive treatment of malaria in pregnancy</p>
              <small>2020/2021 session · Prof R. T. Olaniyan · Historical record</small>
            </div>
            <span className="rl-class rl-class--moderate">Moderate similarity</span>
          </li>
        </ul>
        <div className="rl-proof__foot">
          <p>The decision remains with your lecturer.</p>
          <div className="rl-proof__actions" aria-hidden="true">
            <span className="rl-proof__btn rl-proof__btn--ghost">Refine topic</span>
            <span className="rl-proof__btn rl-proof__btn--primary">Continue to submission</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

/* State 2 — lecturer review at rest, rendered to current Board A/B truth:
   classification primary, raw cosine subordinate (never a percentage),
   side-by-side recorded context, rationale contract for reject AND revision. */
function StateTwoWindow() {
  return (
    <figure className="rl-window" aria-label="Product preview: lecturer review">
      <WindowChrome
        path="/lecturer/pending-reviews/1042"
        name="F. A. Adewale"
        initials="FA"
        role="Lecturer"
      />
      <div className="rl-window__body">
        <div className="rl-proof__head">
          <span className="rl-proof__crumb">Submission Details</span>
          <span className="rl-proof__pill rl-proof__pill--pending">Pending review</span>
        </div>
        <p className="rl-proof__field"><small>Submitted topic</small>Knowledge and practice of malaria prevention among mothers of under-five children in Osogbo</p>
        <p className="rl-proof__advisory">Similarity evidence is advisory. Final decisions remain lecturer-controlled.</p>
        <dl className="rl-proof__meta">
          <div><dt>Student name</dt><dd>Adaeze Example</dd></div>
          <div><dt>Academic session</dt><dd>2025/2026</dd></div>
          <div><dt>Category</dt><dd>Public Health</dd></div>
        </dl>
        <div className="rl-proof__closest">
          <div className="rl-proof__closesthead">
            <small>Closest related record</small>
            <span className="rl-class rl-class--higher">Higher similarity</span>
            <code>cosine 0.714</code>
          </div>
          <p>Assessment of malaria prevention practices among caregivers of under-five children in Olorunda LGA</p>
          <small>2022/2023 session · Dr F. A. Adewale · Historical record</small>
          <table className="rl-proof__compare">
            <thead><tr><th scope="col" aria-label="Field" /><th scope="col">Proposed</th><th scope="col">This record</th></tr></thead>
            <tbody>
              <tr><th scope="row">Population</th><td data-side="Proposed">Mothers of children under five</td><td data-side="This record">Caregivers of under-five children</td></tr>
              <tr><th scope="row">Location</th><td data-side="Proposed">Osogbo, Osun State</td><td data-side="This record">Olorunda LGA, Osun State</td></tr>
              <tr><th scope="row">Study focus</th><td data-side="Proposed">Prevention knowledge and household practice</td><td data-side="This record">Prevention practices</td></tr>
            </tbody>
          </table>
          <small className="rl-proof__note">Recorded metadata shown side by side. The system does not score these fields individually.</small>
        </div>
        <div className="rl-proof__decision">
          <small>Controlled action</small>
          <p className="rl-proof__decisiontitle">Lecturer decision</p>
          <div className="rl-proof__rationale" aria-hidden="true">
            <small>Decision rationale / comment</small>
            <span>Add the reason for this decision…</span>
          </div>
          <small className="rl-proof__note">Required when rejecting a topic or requesting a revision. Similarity evidence remains advisory.</small>
          <div className="rl-proof__actions" aria-hidden="true">
            <span className="rl-proof__btn rl-proof__btn--primary">Approve</span>
            <span className="rl-proof__btn rl-proof__btn--ghost">Request Revision</span>
            <span className="rl-proof__btn rl-proof__btn--danger">Reject</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

/* State 3 — the recorded decision, rendered to current Board B truth:
   decision-first, terminal controls removed (not disabled). */
function StateThreeWindow() {
  return (
    <figure className="rl-window" aria-label="Product preview: recorded decision">
      <WindowChrome
        path="/lecturer/pending-reviews/1042"
        name="F. A. Adewale"
        initials="FA"
        role="Lecturer"
      />
      <div className="rl-window__body">
        <div className="rl-proof__head">
          <span className="rl-proof__crumb">Submission Details</span>
          <span className="rl-proof__pill rl-proof__pill--approved">Approved</span>
        </div>
        <p className="rl-proof__field"><small>Submitted topic</small>Knowledge and practice of malaria prevention among mothers of under-five children in Osogbo</p>
        <div className="rl-proof__rationalecard">
          <small>Stored lecturer rationale</small>
          <p>Related work exists in the 2022/2023 record, but the proposed population, location and study focus differ enough to support a distinct project. Approved on condition the student cites the Olorunda LGA study.</p>
          <small className="rl-proof__decider">Decided by <b>Dr F. A. Adewale</b> on <b>14 Mar 2026, 11:08</b></small>
        </div>
        <p className="rl-proof__terminal">This submission is no longer pending review, so no further decision can be recorded here.</p>
      </div>
    </figure>
  );
}

const BOUNDARY_STATEMENTS = [
  ['Low similarity is not originality', 'A quiet result means no closely related record was found. It proves nothing more.'],
  ['High similarity is not rejection', 'Closely related work is a reason to look carefully, not an automatic outcome.'],
  ['It does not detect plagiarism', 'The system compares topics and context. It never judges conduct or quality.'],
  ['An empty record is reported honestly', 'With nothing to compare against, the system says so. It never claims a topic is new.']
];

const ACCESS_ROWS = [
  ['Students', 'Sign in with your matric number.'],
  ['Lecturers', 'Sign in with your registered email address.'],
  ['Administrators', 'Sign in with your registered email address.']
];

function LandingPage() {
  return (
    <div className="rl rl-final">
      <a className="rl-skip" href="#landing-main">Skip to main content</a>
      <Masthead />
      <main id="landing-main" tabIndex="-1">
        {/* Hero — dark field; the State 1 window crosses the dark→paper edge. */}
        <section className="rl-hero" id="top" tabIndex="-1" aria-labelledby="landing-title">
          <div className="rl-hero__dark">
            <div className="rl-shell rl-hero__copy">
              <p className="rl-eyebrow rl-eyebrow--ondark">Research decision support</p>
              <h1 id="landing-title">See related research before the decision.</h1>
              <p className="rl-hero__lede">Students check a topic before submitting it. Lecturers review it beside the related work already on file.</p>
              <div className="rl-hero__cta">
                <Link className="rl-btn rl-btn--primary" to="/login">Sign in to your workspace</Link>
                <AnchorLink className="rl-hero__how" id="how-it-works">How it works</AnchorLink>
              </div>
            </div>
          </div>
          <div className="rl-shell rl-shell--proof rl-hero__proof" id="how-it-works" tabIndex="-1">
            <StateOneWindow />
            <StateCaption state="1">
              The private pre-check a student runs before submitting. {PROOF_DISCLAIMER} Similarity is advisory evidence; approval remains an academic decision.
            </StateCaption>
          </div>
        </section>

        {/* State 2 unit: eyebrow → 34px heading → one line → plate → caption. */}
        <section className="rl-state" aria-labelledby="state2-title">
          <div className="rl-shell rl-state__head">
            <p className="rl-eyebrow">The same screen, one step later</p>
            <h2 id="state2-title">Evidence a lecturer can weigh</h2>
            <p className="rl-state__line">Recorded context sits beside the proposal, and the decision controls sit at the foot of the same screen.</p>
          </div>
          <div className="rl-shell rl-shell--proof">
            <StateTwoWindow />
            <StateCaption state="2">
              Lecturer review with the decision controls at rest. {PROOF_DISCLAIMER}
            </StateCaption>
          </div>
        </section>

        {/* State 3 unit. */}
        <section className="rl-state" aria-labelledby="state3-title">
          <div className="rl-shell rl-state__head">
            <p className="rl-eyebrow">Where the sequence ends</p>
            <h2 id="state3-title">The decision is a person&apos;s, and it is on the record</h2>
            <p className="rl-state__line">Every outcome stores who decided, when, and why.</p>
          </div>
          <div className="rl-shell rl-shell--proof">
            <StateThreeWindow />
            <StateCaption state="3">
              The same screen once a decision is recorded. Illustrative product preview — the rationale is a worked example, not a departmental decision.
            </StateCaption>
          </div>
        </section>

        {/* Boundary — four statements on full-measure hairlines. */}
        <section className="rl-boundary" id="evidence" tabIndex="-1" aria-labelledby="boundary-title">
          <div className="rl-shell rl-state__head">
            <h2 id="boundary-title">The boundary this system keeps</h2>
            <p className="rl-state__line">Similarity informs the decision. It never makes it.</p>
          </div>
          <dl className="rl-shell rl-boundary__list">
            {BOUNDARY_STATEMENTS.map(([statement, line]) => (
              <div key={statement}>
                <dt>{statement}</dt>
                <dd>{line}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Close — V3 composition literally: 560 measure, rigid rows, 260px button. */}
        <section className="rl-close" id="access" tabIndex="-1" aria-labelledby="close-title">
          <div className="rl-close__inner">
            <h2 id="close-title">Continue to your workspace</h2>
            <dl className="rl-close__rows">
              {ACCESS_ROWS.map(([role, line]) => (
                <div key={role}><dt>{role}</dt><dd>{line}</dd></div>
              ))}
            </dl>
            <Link className="rl-btn rl-btn--primary rl-close__btn" to="/login">Sign in to the DSS</Link>
            <p className="rl-close__note">Accounts are provisioned by the department — there is no self-registration.</p>
          </div>
        </section>
      </main>
      <footer className="rl-footer">
        <div className="rl-shell rl-footer__inner">
          <span>Research Topic Approval DSS</span>
          <span>UNIOSUN · Department of Public Health · Pre-pilot staging environment</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
