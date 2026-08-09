import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: vi.fn()
}));

import { useAuth } from '../../src/auth/useAuth';
import App from '../../src/App';

const validTopic = 'Machine learning methods for public health surveillance systems';
const validKeywords = 'machine learning, public health';
const validCategory = 'Epidemiology';

function buildAuthState(user = { role: 'student', name: 'Student Demo' }) {
  return {
    forgotPassword: vi.fn(),
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    resetPassword: vi.fn(),
    user
  };
}

function renderAppAt(path, authState = buildAuthState()) {
  useAuth.mockReturnValue(authState);

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

function buildFypResponse({ risk = 'LOW', maxSimilarity = 24, status = 'success', matches = [] } = {}) {
  return {
    status,
    message: status === 'partial_success' ? 'Semantic analysis is temporarily unavailable.' : '',
    data: {
      overall_risk: risk,
      max_similarity: maxSimilarity,
      recommendation: `${risk} similarity guidance from backend.`,
      tier1_historical: matches,
      tier2_current: [],
      tier3_under_review: []
    }
  };
}

async function submitValidTopic(user) {
  await user.type(screen.getByPlaceholderText(/enter your research topic/i), validTopic);
  await user.selectOptions(screen.getByLabelText(/research area/i), validCategory);
  await user.type(screen.getByLabelText(/keywords/i), validKeywords);
  await user.click(screen.getByRole('button', { name: /check similarity/i }));
}

function postedPaths(mock) {
  return mock.history.post.map(({ url }) => url);
}

describe('End-to-End User Flow Tests', () => {
  let mock;
  let user;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    user = userEvent.setup();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  it('renders the public landing page at the root route', () => {
    renderAppAt('/', buildAuthState(null));

    expect(screen.getByRole('heading', { level: 1, name: /better research topics begin with better evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /sign in/i }).every(link => link.getAttribute('href') === '/login')).toBe(true);
    expect(screen.getByText(/illustrative approval workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/similarity evidence supports the decision/i)).toBeInTheDocument();
    expect(screen.getByText(/does not offer self-registration/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated protected student route visits to the login shell', async () => {
    renderAppAt('/student/check-my-topic', buildAuthState(null));

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/university email address/i)).toBeInTheDocument();
    expect(screen.getByText(/^No role selector$/i)).toBeInTheDocument();
  });

  it('preserves role protection by redirecting a wrong-role user to their own dashboard', async () => {
    mock.onAny().reply(200, { data: { submissions: [] }, meta: {} });
    renderAppAt(
      '/student/check-my-topic',
      buildAuthState({ role: 'lecturer', name: 'Lecturer Test' })
    );

    expect(await screen.findByRole('navigation', { name: /^lecturer navigation$/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /^student navigation$/i })).not.toBeInTheDocument();
  });

  it('renders the authenticated student check-my-topic route through AppLayout', async () => {
    renderAppAt('/student/check-my-topic');

    expect(await screen.findByRole('heading', { name: /check my topic/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^student navigation$/i })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: /^student navigation$/i })).getByRole('link', { name: /^check my topic$/i })).toHaveAttribute('href', '/student/check-my-topic');
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByText(/advisory pre-check/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toBeInTheDocument();
  });

  it('uses the shared authenticated Student shell on the dashboard route', async () => {
    renderAppAt('/student/dashboard');

    expect(await screen.findByRole('heading', { name: /student dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^student navigation$/i })).toBeInTheDocument();
  });

  it('uses the shared role shell for a trailing slash and for Lecturer and Admin routes', async () => {
    const { unmount } = renderAppAt('/student/check-my-topic/');
    expect(await screen.findByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    unmount();

    const lecturerRender = renderAppAt('/lecturer/dashboard', buildAuthState({ role: 'lecturer', name: 'Lecturer Test' }));
    expect(await screen.findByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^lecturer navigation$/i })).toBeInTheDocument();
    lecturerRender.unmount();

    renderAppAt('/admin/dashboard', buildAuthState({ role: 'admin', name: 'Admin Test' }));
    expect(await screen.findByRole('link', { name: /research topic approval dss home/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^administrator navigation$/i })).toBeInTheDocument();
  });

  it.each([
    ['/student/dashboard', 'student', 'Student'],
    ['/student/submit-topic', 'student', 'Student'],
    ['/student/my-submissions', 'student', 'Student'],
    ['/student/check-my-topic', 'student', 'Student'],
    ['/student/research-explorer', 'student', 'Student'],
    ['/lecturer/dashboard', 'lecturer', 'Lecturer'],
    ['/lecturer/pending-reviews', 'lecturer', 'Lecturer'],
    ['/lecturer/pending-reviews/submission-1', 'lecturer', 'Lecturer'],
    ['/lecturer/check-similarity', 'lecturer', 'Lecturer'],
    ['/lecturer/my-decisions', 'lecturer', 'Lecturer'],
    ['/lecturer/supervisees', 'lecturer', 'Lecturer'],
    ['/lecturer/research-trends', 'lecturer', 'Lecturer'],
    ['/admin/dashboard', 'admin', 'Administrator'],
    ['/admin/user-management', 'admin', 'Administrator'],
    ['/admin/topic-repository', 'admin', 'Administrator'],
    ['/admin/system-settings', 'admin', 'Administrator'],
    ['/admin/audit-log', 'admin', 'Administrator'],
    ['/admin/reports', 'admin', 'Administrator']
  ])('mounts the shared %s route inside its role shell', async (path, role, label) => {
    mock.onAny().reply(200, {
      data: {
        assignments: [],
        decisions: [],
        items: [],
        logs: [],
        settings: [],
        snapshots: [],
        submissions: [],
        supervisees: [],
        topics: [],
        users: []
      },
      meta: {}
    });

    renderAppAt(path, buildAuthState({ role, name: `${label} Test` }));

    expect(await screen.findByRole('navigation', { name: new RegExp(`^${label} navigation$`, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /research topic approval dss home/i })).toHaveAttribute('href', `/${role}/dashboard`);
  });

  it('opens the responsive student menu and restores focus after Escape', async () => {
    renderAppAt('/student/check-my-topic');
    const menuButton = await screen.findByRole('button', { name: 'Menu' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/account and session/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });

  it('posts the exact student similarity payload to the public similarity endpoint', async () => {
    mock.onPost('/api/similarity/check').reply(200, buildFypResponse());
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    await waitFor(() => {
      expect(mock.history.post).toHaveLength(1);
    });

    expect(mock.history.post[0].url).toBe('/api/similarity/check');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      topic: validTopic,
      keywords: validKeywords,
      category: validCategory
    });
  });

  it('renders successful HIGH similarity results through ResultsDisplay', async () => {
    mock.onPost('/api/similarity/check').reply(200, buildFypResponse({
      risk: 'HIGH',
      maxSimilarity: 88,
      matches: [
        {
          id: 1,
          title: 'Public Health Surveillance Systems',
          supervisor: 'Dr. Similar',
          year: '2024/2025',
          category: 'Epidemiology',
          jaccard: 88,
          tfidf: 80,
          sbert: 84
        }
      ]
    }));
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('results-display')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('High Risk');
    expect(screen.getByTestId('max-similarity')).toHaveTextContent('88%');
    expect(screen.getAllByText(/public health surveillance systems/i)).toHaveLength(2);
    expect(screen.queryByPlaceholderText(/enter your research topic/i)).not.toBeInTheDocument();
    expect(screen.getByText(/temporary browser state only/i)).toBeInTheDocument();
  });

  it('renders successful LOW similarity results through ResultsDisplay', async () => {
    mock.onPost('/api/similarity/check').reply(200, buildFypResponse({
      risk: 'LOW',
      maxSimilarity: 18,
      matches: [
        {
          id: 2,
          title: 'Machine Learning in Public Health',
          supervisor: 'Dr. Similar',
          year: '2025/2026',
          category: 'Epidemiology',
          jaccard: 18,
          tfidf: 12,
          sbert: 16
        }
      ]
    }));
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('Low Risk');
    expect(screen.getByTestId('max-similarity')).toHaveTextContent('18%');
    expect(screen.getByText(/machine learning in public health/i)).toBeInTheDocument();
  });

  it('clears the result when checking another topic', async () => {
    mock.onPost('/api/similarity/check').reply(200, buildFypResponse({
      risk: 'LOW',
      maxSimilarity: 10
    }));
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check another topic/i }));

    expect(screen.queryByTestId('student-results-container')).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting topic check/i)).toBeInTheDocument();
  });

  it('displays backend error responses from the similarity endpoint', async () => {
    mock.onPost('/api/similarity/check').reply(500, {
      message: 'Similarity service failed.'
    });
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    expect(await screen.findByText(/similarity service failed/i)).toBeInTheDocument();
    expect(screen.queryByTestId('student-results-container')).not.toBeInTheDocument();
  });

  it('keeps the routed student checker read-only and decision-free', async () => {
    mock.onPost('/api/similarity/check').reply(200, buildFypResponse({
      risk: 'HIGH',
      maxSimilarity: 92
    }));
    renderAppAt('/student/check-my-topic');

    await submitValidTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(postedPaths(mock)).toEqual(['/api/similarity/check']);
    expect(postedPaths(mock).some(path => path.includes('/submissions'))).toBe(false);
    expect(postedPaths(mock).some(path => path.includes('/lecturer'))).toBe(false);
    expect(postedPaths(mock).some(path => path.includes('snapshot'))).toBe(false);
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/decision rationale/i)).not.toBeInTheDocument();
  });
});
