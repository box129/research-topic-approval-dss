import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import './LandingPage.css';

const MOBILE_QUERY = '(max-width: 48rem)';

const navigationItems = [
  ['why', 'Why it exists'],
  ['roles', 'Who it supports'],
  ['evidence', 'Similarity evidence'],
  ['approval', 'How approval works'],
  ['governance', 'Governance']
];

const roleJourneys = [
  {
    number: '01',
    role: 'Student',
    title: 'Develop and submit an informed proposal.',
    items: ['Privately pre-check an idea', 'Submit a topic', 'Track review status', 'View lecturer feedback and outcomes']
  },
  {
    number: '02',
    role: 'Lecturer',
    title: 'Examine evidence and record a decision.',
    items: ['Inspect assigned submissions', 'Run or review similarity evidence', 'Inspect supported saved evidence', 'Approve, reject or request revision with rationale', 'Review previous decisions']
  },
  {
    number: '03',
    role: 'Administrator',
    title: 'Maintain the records around the workflow.',
    items: ['Inspect account records', 'Manage supported account-status workflows', 'Manage lecturer–student assignments', 'Maintain supported topic repositories', 'Preview and commit authorised imports', 'Inspect audit records', 'Access supported summaries and CSV exports']
  }
];

const methods = [
  ['J', 'Jaccard similarity', 'Identifies direct overlap between important words and terms.'],
  ['T', 'TF-IDF with cosine similarity', 'Gives greater weight to informative terms and compares lexical structure.'],
  ['S', 'SBERT semantic similarity', 'Examines contextual meaning so related topics may still be recognised when wording differs.']
];

const approvalSteps = [
  ['01', 'Topic submission', 'The student records a proposed topic for formal review.'],
  ['02', 'Similarity checking', 'The workflow compares the proposal with relevant repository records.'],
  ['03', 'Lecturer review', 'An authorised lecturer considers the proposal, evidence and academic context.'],
  ['04', 'Decision record', 'Approval, rejection or a request for revision is recorded with rationale where required.']
];

function useMobileNavigation() {
  const location = useLocation();
  const queryRequestsOpen = new URLSearchParams(location.search).get('menu') === 'open';
  const getIsMobile = () => window.matchMedia?.(MOBILE_QUERY).matches ?? false;
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [isOpen, setIsOpen] = useState(() => getIsMobile() && queryRequestsOpen);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => {
      setIsMobile(event.matches);
      setIsOpen(event.matches && queryRequestsOpen);
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, [queryRequestsOpen]);

  return { isMobile, isOpen, setIsOpen };
}

function AnchorLink({ id, children, className = '', onNavigate, ariaLabel }) {
  const location = useLocation();

  const handleClick = (event) => {
    event.preventDefault();
    onNavigate?.();
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
  id: PropTypes.string.isRequired,
  onNavigate: PropTypes.func
};

function Brand() {
  return (
    <AnchorLink id="top" className="landing-brand" ariaLabel="Research Topic Approval DSS home">
      <span className="landing-brand__mark" aria-hidden="true">U</span>
      <span className="landing-brand__full"><strong>UNIOSUN</strong><br />Research Topic Approval DSS</span>
      <span className="landing-brand__short" aria-hidden="true">Approval DSS</span>
    </AnchorLink>
  );
}

function MenuIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  );
}

MenuIcon.propTypes = { open: PropTypes.bool.isRequired };

function PublicMasthead() {
  const { isMobile, isOpen, setIsOpen } = useMobileNavigation();
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, setIsOpen]);

  return (
    <header className="landing-masthead" data-testid="landing-masthead">
      <div className="landing-container landing-masthead__inner">
        <Brand />
        <div className="landing-masthead__actions">
          <span className="landing-environment">Staging demo</span>
          <Link className="landing-button landing-button--compact landing-button--primary" to="/login">Sign In</Link>
          <button
            className="landing-menu-toggle"
            ref={menuButtonRef}
            type="button"
            aria-label={isOpen ? 'Close menu' : 'Menu'}
            aria-expanded={isOpen}
            aria-controls="landing-navigation"
            onClick={() => setIsOpen((current) => !current)}
          >
            <MenuIcon open={isOpen} /><span>{isOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
        <nav
          id="landing-navigation"
          className="landing-nav"
          aria-label="Landing page"
          hidden={isMobile && !isOpen}
        >
          {navigationItems.map(([id, label]) => (
            <AnchorLink key={id} id={id} onNavigate={() => setIsOpen(false)}>{label}</AnchorLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function WorkflowFigure() {
  return (
    <figure className="landing-workflow" aria-labelledby="workflow-caption">
      <figcaption id="workflow-caption">Illustrative approval workflow</figcaption>
      <div className="landing-workflow__chain">
        <div className="landing-workflow__node landing-workflow__node--start">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 13h5M10 17h5" /></svg>
          <span>Proposed topic</span>
        </div>
        <span className="landing-workflow__arrow" aria-hidden="true">→</span>
        <div className="landing-workflow__node"><span>01</span><strong>Jaccard, TF-IDF/Cosine and SBERT</strong></div>
        <span className="landing-workflow__arrow" aria-hidden="true">→</span>
        <div className="landing-workflow__node"><span>02</span><strong>Historical, current-session and under-review records</strong></div>
        <span className="landing-workflow__arrow" aria-hidden="true">→</span>
        <div className="landing-workflow__node landing-workflow__node--evidence"><span>03</span><strong>Advisory similarity evidence</strong></div>
        <span className="landing-workflow__arrow" aria-hidden="true">→</span>
        <div className="landing-workflow__node landing-workflow__node--decision">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9M4 3h16v18H4z" /></svg>
          <strong>Lecturer-controlled decision</strong>
        </div>
      </div>
    </figure>
  );
}

function LandingHero() {
  return (
    <section className="landing-hero" id="top" tabIndex="-1" aria-labelledby="landing-title">
      <div className="landing-container landing-hero__grid">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">Research decision support</p>
          <h1 id="landing-title">Better research topics begin with better evidence.</h1>
          <p className="landing-hero__lede">A role-based decision-support system that compares proposed undergraduate research topics with existing records using lexical and semantic similarity while keeping final approval under lecturer control.</p>
          <div className="landing-button-row">
            <Link className="landing-button landing-button--primary" to="/login">Sign In to your workspace</Link>
            <AnchorLink className="landing-button landing-button--secondary" id="approval">See how the process works</AnchorLink>
          </div>
          <p className="landing-hero__audience"><strong>For students, lecturers and administrators</strong> working through a traceable topic-approval process.</p>
        </div>
        <WorkflowFigure />
      </div>
    </section>
  );
}

function WhyPlatformSection() {
  return (
    <section className="landing-section landing-section--cream" id="why" tabIndex="-1" aria-labelledby="why-title">
      <div className="landing-container landing-split-intro">
        <div><p className="landing-eyebrow">Why it exists</p><h2 id="why-title">A clearer basis for discussing topic similarity.</h2></div>
        <div className="landing-prose">
          <p>Topic review can rely on stored titles and keyword-only checking. That can make synonyms, paraphrases and differently worded but related topics harder to identify consistently across academic sessions.</p>
          <p>The platform is designed to bring related records and multiple comparison methods into one traceable evidence trail—without replacing academic judgement or guaranteeing originality.</p>
        </div>
      </div>
      <div className="landing-container landing-challenges" aria-label="Challenges the platform is designed to support">
        <div><span>01</span><h3>Beyond exact keywords</h3><p>Support recognition of related meaning when wording differs.</p></div>
        <div><span>02</span><h3>Across academic sessions</h3><p>Support comparison beyond the current intake.</p></div>
        <div><span>03</span><h3>Evidence with context</h3><p>Give lecturers traceable material for review.</p></div>
      </div>
    </section>
  );
}

function RoleJourneySection() {
  return (
    <section className="landing-section" id="roles" tabIndex="-1" aria-labelledby="roles-title">
      <div className="landing-container landing-heading landing-heading--center">
        <p className="landing-eyebrow">Who it supports</p>
        <h2 id="roles-title">One process, three distinct responsibilities.</h2>
        <p>Each role sees the work and evidence appropriate to its part in the approval process.</p>
      </div>
      <div className="landing-container landing-roles">
        {roleJourneys.map((role) => (
          <article key={role.role}>
            <p className="landing-role-number">{role.number} / {role.role}</p>
            <h3>{role.title}</h3>
            <ul>{role.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function SimilarityEvidenceSection() {
  return (
    <section className="landing-section landing-section--green" id="evidence" tabIndex="-1" aria-labelledby="evidence-title">
      <div className="landing-container landing-evidence-layout">
        <div className="landing-heading landing-heading--light">
          <p className="landing-eyebrow">Similarity evidence</p>
          <h2 id="evidence-title">Three perspectives on how topics relate.</h2>
          <p>The combined result supports academic review. It does not automatically approve or reject a proposal.</p>
        </div>
        <div className="landing-methods">
          {methods.map(([code, title, copy]) => (
            <article key={title}><span className="landing-method-code">{code}</span><div><h3>{title}</h3><p>{copy}</p></div></article>
          ))}
        </div>
      </div>
      <div className="landing-container landing-disclosure-wrap">
        <details>
          <summary>How the methods complement one another</summary>
          <p>Jaccard makes direct term overlap legible. TF-IDF/Cosine reduces the influence of common vocabulary. SBERT adds contextual, sentence-level comparison. Together they provide different signals for an authorised reviewer to interpret.</p>
        </details>
      </div>
    </section>
  );
}

function ApprovalWorkflowSection() {
  return (
    <section className="landing-section" id="approval" tabIndex="-1" aria-labelledby="approval-title">
      <div className="landing-container landing-heading"><p className="landing-eyebrow">From proposal to decision</p><h2 id="approval-title">A guided approval sequence with a human decision at its centre.</h2></div>
      <ol className="landing-container landing-approval-steps">
        {approvalSteps.map(([number, title, copy]) => <li key={title}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}
      </ol>
      <div className="landing-container landing-revision" aria-label="Optional revision path">
        <p>Possible revision path</p>
        <div><span>Revision requested</span><b aria-hidden="true">→</b><span>Student submits a revised topic</span><b aria-hidden="true">→</b><span>Lecturer reviews again</span><em aria-hidden="true">↩ returns to review</em></div>
      </div>
      <div className="landing-container landing-principle">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7Z" /></svg>
        <p><strong>Similarity evidence supports the decision.</strong> It does not make the decision.</p>
      </div>
    </section>
  );
}

function RepositoryLifecycleSection() {
  const metadata = ['Topic title', 'Academic session', 'Category', 'Keywords', 'Supervisor where available', 'Population, location or study focus where recorded', 'Lifecycle status'];
  return (
    <section className="landing-section landing-section--cream" id="repository" tabIndex="-1" aria-labelledby="repository-title">
      <div className="landing-container landing-repository-layout">
        <div className="landing-heading"><p className="landing-eyebrow">Structured topic repository</p><h2 id="repository-title">Comparison grounded in topic records across their lifecycle.</h2><p>Depending on the supported workflow, comparison may draw on historical topics, current-session topics and topics still under review.</p></div>
        <div className="landing-repository" aria-label="Topic repository record groups">
          <div><strong>Historical topics</strong><small>Prior sessions</small></div>
          <div><strong>Current-session topics</strong><small>Present records</small></div>
          <div><strong>Under-review topics</strong><small>Active proposals</small></div>
          <section><h3>Available metadata may include</h3><ul>{metadata.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </div>
      </div>
    </section>
  );
}

const evidenceFacts = [['Produced by', 'The checking workflow'], ['Identifies', 'Related stored records'], ['Draws on', 'Lexical and semantic approaches'], ['May support', 'Saved lecturer evidence snapshots']];
const decisionFacts = [['Made by', 'An authorised lecturer'], ['Considers', 'The proposal and academic context'], ['May record', 'Approve, reject or request revision'], ['Documents', 'Rationale where required']];

function ComparisonRecord({ label, title, facts, decision = false }) {
  return (
    <article className={decision ? 'landing-comparison__decision' : ''}>
      <p className="landing-comparison__label"><span aria-hidden="true">{decision ? 'B' : 'A'}</span>{label}</p>
      <h3>{title}</h3>
      <dl>{facts.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
    </article>
  );
}

ComparisonRecord.propTypes = {
  decision: PropTypes.bool,
  facts: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};

function EvidenceVsDecisionSection() {
  return (
    <section className="landing-section" id="judgement" tabIndex="-1" aria-labelledby="judgement-title">
      <div className="landing-container landing-heading landing-heading--center"><p className="landing-eyebrow">Evidence and academic judgement</p><h2 id="judgement-title">A deliberate boundary between finding similarity and making a decision.</h2></div>
      <div className="landing-container landing-comparison">
        <ComparisonRecord label="Similarity evidence" title="Material for informed review" facts={evidenceFacts} />
        <div className="landing-comparison__divider" aria-hidden="true">informs</div>
        <ComparisonRecord label="Academic decision" title="A judgement with accountable rationale" facts={decisionFacts} decision />
      </div>
    </section>
  );
}

function GovernanceSection() {
  const items = [
    ['01', 'Role-protected access', 'Workspaces and actions follow assigned responsibilities.'],
    ['02', 'Account-status management', 'Supported account-status workflows are managed explicitly.'],
    ['03', 'Lecturer–student assignment records', 'Supported assignments preserve accountable relationships.'],
    ['04', 'Controlled repository imports', 'Authorised imports can be previewed before commit.'],
    ['05', 'Audit and administrative records', 'Audit records, guarded purge, aggregate summaries and supported CSV exports aid traceability.']
  ];
  return (
    <section className="landing-section landing-section--green-soft" id="governance" tabIndex="-1" aria-labelledby="governance-title">
      <div className="landing-container landing-governance-layout">
        <div className="landing-heading"><p className="landing-eyebrow">Governance and traceability</p><h2 id="governance-title">The surrounding controls keep academic work attributable.</h2><p>Supported administration and record-keeping provide context for who can act and how repository changes are handled.</p></div>
        <ol className="landing-governance-list">{items.map(([number, title, copy]) => <li key={title}><span>{number}</span><div><strong>{title}</strong><small>{copy}</small></div></li>)}</ol>
      </div>
    </section>
  );
}

function TechnicalFoundationDisclosure() {
  return (
    <section className="landing-section landing-technical" id="technical" tabIndex="-1" aria-labelledby="technical-title">
      <div className="landing-container landing-technical__inner">
        <div><p className="landing-eyebrow">Technical foundation</p><h2 id="technical-title">A role-protected application with a separate semantic service.</h2></div>
        <details className="landing-technical__disclosure">
          <summary>View technical architecture</summary>
          <div className="landing-architecture" aria-label="Technical architecture">
            <p>Technical architecture</p>
            <div><strong>React</strong><span>Frontend</span></div><b aria-hidden="true">→</b>
            <div><strong>Node.js / Express</strong><span>Application API</span></div><b aria-hidden="true">→</b>
            <div><strong>PostgreSQL / Prisma</strong><span>Application records</span></div><b aria-hidden="true">+</b>
            <div><strong>Python / FastAPI</strong><span>Semantic service</span></div>
          </div>
          <p>Role-protected workflows connect the frontend to the application API. The semantic service provides contextual comparison alongside lexical methods. This static diagram describes architecture; it does not report runtime status.</p>
        </details>
      </div>
    </section>
  );
}

function FinalSignInCTA() {
  return (
    <section className="landing-final" aria-labelledby="final-title">
      <div className="landing-container landing-final__inner">
        <div><p className="landing-eyebrow">Continue to your workspace</p><h2 id="final-title">Continue to your research workspace</h2><p>Students, lecturers and administrators use the same secure sign-in and are directed to the workspace assigned to their account.</p></div>
        <Link className="landing-button landing-button--gold" to="/login">Sign In to the DSS</Link>
      </div>
      <div className="landing-container landing-staging"><strong>Staging demo</strong><span>This staging experience does not offer self-registration.</span></div>
    </section>
  );
}

function LandingPage() {
  return (
    <div className="public-landing">
      <a className="landing-skip" href="#landing-main">Skip to main content</a>
      <PublicMasthead />
      <main id="landing-main" tabIndex="-1">
        <LandingHero />
        <WhyPlatformSection />
        <RoleJourneySection />
        <SimilarityEvidenceSection />
        <ApprovalWorkflowSection />
        <RepositoryLifecycleSection />
        <EvidenceVsDecisionSection />
        <GovernanceSection />
        <TechnicalFoundationDisclosure />
        <FinalSignInCTA />
      </main>
      <footer className="landing-footer"><div className="landing-container"><span>Research Topic Approval DSS</span><AnchorLink id="top">Back to top ↑</AnchorLink></div></footer>
    </div>
  );
}

export default LandingPage;
