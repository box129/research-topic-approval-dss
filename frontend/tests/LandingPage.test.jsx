import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../src/pages/LandingPage';

function installMatchMedia({ mobile = false, reducedMotion = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : mobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

function renderLanding(path = '/', options = {}) {
  installMatchMedia(options);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  return render(<MemoryRouter initialEntries={[path]}><LandingPage /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LandingPage', () => {
  it('renders the approved identity, hierarchy and eleven information areas', () => {
    renderLanding();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Better research topics begin with better evidence.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByTestId('landing-masthead')).toBeInTheDocument();
    expect(screen.getByText('Illustrative approval workflow')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#landing-main');
    expect(document.getElementById('landing-main')).toHaveAttribute('tabindex', '-1');

    [
      'A clearer basis for discussing topic similarity.',
      'One process, three distinct responsibilities.',
      'Three perspectives on how topics relate.',
      'A guided approval sequence with a human decision at its centre.',
      'Comparison grounded in topic records across their lifecycle.',
      'A deliberate boundary between finding similarity and making a decision.',
      'The surrounding controls keep academic work attributable.',
      'A role-protected application with a separate semantic service.',
      'Continue to your research workspace'
    ].forEach((heading) => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument());
  });

  it('renders all supported roles, evidence methods and workflow stages', () => {
    renderLanding();

    ['Student', 'Lecturer', 'Administrator'].forEach((role) => expect(screen.getByText(new RegExp(`/ ${role}$`))).toBeInTheDocument());
    ['Jaccard similarity', 'TF-IDF with cosine similarity', 'SBERT semantic similarity'].forEach((method) => expect(screen.getByRole('heading', { name: method })).toBeInTheDocument());
    ['Proposed topic', 'Jaccard, TF-IDF/Cosine and SBERT', 'Historical, current-session and under-review records', 'Advisory similarity evidence', 'Lecturer-controlled decision'].forEach((stage) => expect(screen.getByText(stage)).toBeInTheDocument());
    ['Topic submission', 'Similarity checking', 'Lecturer review', 'Decision record'].forEach((stage) => expect(screen.getByRole('heading', { name: stage })).toBeInTheDocument());
    ['Revision requested', 'Student updates and resubmits', 'Lecturer reviews again'].forEach((stage) => expect(screen.getByText(stage)).toBeInTheDocument());
  });

  it('renders repository, comparison and supported governance content', () => {
    renderLanding();

    ['Historical topics', 'Current-session topics', 'Under-review topics'].forEach((group) => expect(screen.getByText(group)).toBeInTheDocument());
    expect(screen.getByText('Material for informed review')).toBeInTheDocument();
    expect(screen.getByText('A judgement with accountable rationale')).toBeInTheDocument();
    expect(screen.getByText(/guarded purge/i)).toBeInTheDocument();
    expect(screen.getByText('Supported CSV exports', { exact: false })).toBeInTheDocument();
  });

  it('uses /login for every Sign In link and exposes no authenticated navigation', () => {
    renderLanding();

    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks).toHaveLength(3);
    signInLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    ['Dashboard', 'Submissions', 'Analytics', 'Library', 'Archive', 'Search', 'History', 'Profile'].forEach((label) => {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    });
  });

  it('keeps mobile navigation closed by default and toggles its accessible state', async () => {
    const user = userEvent.setup();
    renderLanding('/', { mobile: true });

    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Landing page' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Landing page' })).toBeInTheDocument();
  });

  it('initialises ?menu=open on mobile and closes after anchor navigation', async () => {
    const user = userEvent.setup();
    renderLanding('/?menu=open', { mobile: true });

    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation', { name: 'Landing page' });
    await user.click(within(navigation).getByRole('link', { name: 'Why it exists' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('why')).toHaveFocus();
  });

  it('supports native methodology and architecture disclosures', async () => {
    const user = userEvent.setup();
    renderLanding();

    const methodology = screen.getByText('How the methods complement one another').closest('details');
    const architecture = screen.getByText('View technical architecture').closest('details');
    expect(methodology).not.toHaveAttribute('open');
    expect(architecture).not.toHaveAttribute('open');
    await user.click(screen.getByText('How the methods complement one another'));
    await user.click(screen.getByText('View technical architecture'));
    expect(methodology).toHaveAttribute('open');
    expect(architecture).toHaveAttribute('open');
  });

  it('does not introduce prohibited public claims or capabilities', () => {
    renderLanding();
    const body = document.body.textContent;
    ['guaranteed originality', 'novelty guarantee', 'automatic approval', 'public archive search', 'feasibility scoring', 'accreditation', 'certification', 'citation mapping', 'research-gap discovery'].forEach((claim) => {
      expect(body.toLowerCase()).not.toContain(claim);
    });
  });
});
