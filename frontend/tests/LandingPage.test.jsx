import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../src/pages/LandingPage';

/*
Contract for the approved landing target — Candidate 3a (refined 2b,
Geist-only). Composition/copy assertions follow the frozen boards; product
truth assertions follow current main (Voyage-only semantics, Board A neutral
classification with subordinate raw cosine, Board B terminal record, staging
honesty, matric-first identity).
*/

function installMatchMedia({ reducedMotion = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
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

describe('LandingPage — approved 3a target', () => {
  it('renders the approved identity, single h1 and masthead index rule', () => {
    renderLanding();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'See related research before the decision.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByTestId('landing-masthead')).toBeInTheDocument();
    expect(screen.getByText('UNIOSUN · Department of Public Health')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#landing-main');
    expect(document.getElementById('landing-main')).toHaveAttribute('tabindex', '-1');

    // The 44px index rule: environment · function · build — the one staging notice.
    expect(screen.getByText('Pre-pilot · staging environment')).toBeInTheDocument();
    expect(screen.getByText('Semantic topic comparison')).toBeInTheDocument();
    expect(screen.getByText('Pre-pilot build')).toBeInTheDocument();
  });

  it('keeps the navigation persistent and visible — no hidden mobile menu', () => {
    renderLanding();

    const navigation = screen.getByRole('navigation', { name: 'Landing page' });
    ['How it works', 'Evidence', 'Access'].forEach((label) => {
      expect(within(navigation).getByRole('link', { name: label })).toBeInTheDocument();
    });
    expect(navigation).not.toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  });

  it('renders the three product-proof states with their mono captions', () => {
    renderLanding();

    expect(screen.getByText('State 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('State 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('State 3 of 3')).toBeInTheDocument();
    expect(screen.getAllByText(/Illustrative product preview/)).toHaveLength(3);

    expect(screen.getByRole('heading', { name: 'Evidence a lecturer can weigh' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "The decision is a person's, and it is on the record" })).toBeInTheDocument();
    expect(screen.getByText('3 related records found')).toBeInTheDocument();
    expect(screen.getByText('The decision remains with your lecturer.')).toBeInTheDocument();
  });

  it('renders the proof content to current product truth, not the old verdict language', () => {
    renderLanding();

    // Board A: neutral classification vocabulary, raw cosine subordinate, never a percentage.
    expect(screen.getAllByText('Higher similarity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Moderate similarity').length).toBeGreaterThan(0);
    expect(screen.getByText('cosine 0.714')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+(\.\d+)?\s?%/);
    expect(document.body.textContent).not.toMatch(/risk level|risk score|high risk|low risk/i);

    // Rationale contract and Board B terminal truth.
    expect(screen.getByText('Required when rejecting a topic or requesting a revision. Similarity evidence remains advisory.')).toBeInTheDocument();
    expect(screen.getByText('This submission is no longer pending review, so no further decision can be recorded here.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/actions are disabled/i);

    // Matric-first identity; no invented student school email.
    expect(screen.getByText('PH/2021/0412')).toBeInTheDocument();
    expect(screen.getByText('Sign in with your matric number.')).toBeInTheDocument();

    // Voyage-only production contract — no retired scorer named as live.
    expect(document.body.textContent).not.toMatch(/\b(?:Jaccard|TF-IDF|SBERT|Sentence-BERT|lexical)\b/i);
  });

  it('renders the boundary section with all four statements', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: 'The boundary this system keeps' })).toBeInTheDocument();
    expect(screen.getByText('Similarity informs the decision. It never makes it.')).toBeInTheDocument();
    [
      'Low similarity is not originality',
      'High similarity is not rejection',
      'It does not detect plagiarism',
      'An empty record is reported honestly'
    ].forEach((statement) => expect(screen.getByText(statement)).toBeInTheDocument());
  });

  it('renders the V3 close: three role rows, centred CTA, no self-registration', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: 'Continue to your workspace' })).toBeInTheDocument();
    ['Students', 'Lecturers', 'Administrators'].forEach((role) => expect(screen.getByText(role)).toBeInTheDocument());
    expect(screen.getAllByText('Sign in with your registered email address.')).toHaveLength(2);
    expect(screen.getByText('Accounts are provisioned by the department — there is no self-registration.')).toBeInTheDocument();
  });

  it('uses /login for every sign-in link and exposes no authenticated navigation', () => {
    renderLanding();

    const signInLinks = [
      screen.getByRole('link', { name: 'Sign in' }),
      screen.getByRole('link', { name: 'Sign in to your workspace' }),
      screen.getByRole('link', { name: 'Sign in to the DSS' })
    ];
    signInLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    ['Dashboard', 'Submissions', 'Analytics', 'Library', 'Archive', 'Search', 'History', 'Profile'].forEach((label) => {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    });
  });

  it('moves focus to the target section on anchor navigation', async () => {
    const user = userEvent.setup();
    renderLanding();

    const navigation = screen.getByRole('navigation', { name: 'Landing page' });
    await user.click(within(navigation).getByRole('link', { name: 'Evidence' }));
    expect(document.getElementById('evidence')).toHaveFocus();

    await user.click(within(navigation).getByRole('link', { name: 'Access' }));
    expect(document.getElementById('access')).toHaveFocus();
  });

  it('does not introduce prohibited public claims, metrics or capabilities', () => {
    renderLanding();
    const body = document.body.textContent.toLowerCase();
    [
      'guaranteed originality', 'novelty guarantee', 'automatic approval',
      'public archive search', 'feasibility scoring', 'accreditation',
      'certification', 'citation mapping', 'research-gap discovery',
      'production-ready', 'departments trust', 'testimonial'
    ].forEach((claim) => expect(body).not.toContain(claim));
    // Synthetic proofs carry their provenance sentence.
    expect(screen.getAllByText(/synthetic records, not departmental data/).length).toBeGreaterThan(0);
  });
});
