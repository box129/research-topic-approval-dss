import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import CheckMyTopicPage from '../src/pages/student/CheckMyTopicPage';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({ post: vi.fn() }))
  }
}));

const validTopic = 'Machine learning methods for public health surveillance systems';
const validKeywords = 'machine learning, public health';
const validCategory = 'Epidemiology';

function renderCheckMyTopicPage() {
  return render(<CheckMyTopicPage />);
}

function buildFypResponse({ risk = 'LOW', maxSimilarity = 0.24, status = 'success', matches = [] } = {}) {
  if (status === 'semantic_unavailable') return { data: { status, message: 'Semantic analysis is temporarily unavailable.', semanticAvailable: false, semanticProvider: 'voyage', semanticModel: 'voyage-4-large' } };
  return {
    data: {
      status,
      semanticAvailable: true,
      semanticProvider: 'voyage',
      semanticModel: 'voyage-4-large',
      data: {
        overall_risk: risk,
        max_similarity: maxSimilarity,
        recommendation: `${risk} similarity guidance from backend.`,
        matches: matches.map(match => ({ ...match, collection: match.collection ?? 'HISTORICAL', semantic_score: match.semantic_score ?? 0.6, similarity_class: risk }))
      }
    }
  };
}

async function submitTopic(user) {
  fireEvent.change(screen.getByPlaceholderText(/enter your research topic/i), { target: { value: validTopic } });
  fireEvent.change(screen.getByLabelText(/research area/i), { target: { value: validCategory } });
  fireEvent.change(screen.getByLabelText(/keywords/i), { target: { value: validKeywords } });
  await user.click(screen.getByRole('button', { name: /check similarity/i }));
}

function postedPaths() {
  return axios.post.mock.calls.map(([path]) => path);
}

describe('CheckMyTopicPage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders page header, guidance, and TopicForm', () => {
    renderCheckMyTopicPage();

    expect(screen.getByRole('heading', { name: /check my topic/i })).toBeInTheDocument();
    expect(screen.getByText(/advisory pre-check/i)).toBeInTheDocument();
    expect(screen.getByText(/does not save or submit your topic/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check similarity/i })).toBeInTheDocument();
  });

  it('posts to the public similarity endpoint with the exact TopicForm payload', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse());
    renderCheckMyTopicPage();

    await submitTopic(user);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/similarity/check',
        {
          topic: validTopic,
          keywords: validKeywords,
          category: validCategory
        },
        expect.objectContaining({
          signal: expect.any(Object)
        })
      );
    });
  });

  it('shows loading state while checking', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    axios.post.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(screen.getByRole('button', { name: /checking similarity/i })).toBeDisabled();
    expect(screen.getByText(/checking the proposed topic against supported research-topic records/i)).toBeInTheDocument();

    resolveRequest(buildFypResponse());
    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
  });

  it('renders LOW result through ResultsDisplay', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({
      risk: 'LOW',
      maxSimilarity: 0.18,
      matches: [
        {
          id: 1,
          title: 'Machine Learning in Public Health',
          supervisor: 'Dr. Similar',
          year: '2025/2026',
          category: 'Epidemiology',
          semantic_score: 0.16
        }
      ]
    }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('Low Risk');
    expect(screen.getByTestId('max-similarity')).toHaveTextContent('0.180');
    expect(screen.getByText(/machine learning in public health/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/enter your research topic/i)).not.toBeInTheDocument();
    expect(screen.getByText(/temporary browser state only/i)).toBeInTheDocument();
  });

  it('renders an advisory no-match state without uniqueness or clearance claims', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 0 }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('no-matches')).toHaveTextContent(/no meaningful matches/i);
    expect(screen.getByTestId('no-matches')).toHaveTextContent(/does not establish originality/i);
    expect(screen.getByTestId('no-matches')).not.toHaveTextContent(/unique|cleared|safe to submit/i);
  });

  it('renders an explicit unavailable state without a risk or fallback claim', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValue({
      response: {
        status: 503,
        data: buildFypResponse({ status: 'semantic_unavailable' }).data
      }
    });
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('semantic-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('risk-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/exact match|term weighting|sbert/i)).not.toBeInTheDocument();
  });

  it('keeps the newest overlapping request active and ignores the older completion', async () => {
    let resolveA;
    let resolveB;
    axios.post
      .mockReturnValueOnce(new Promise(resolve => { resolveA = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveB = resolve; }));
    renderCheckMyTopicPage();

    fireEvent.change(screen.getByPlaceholderText(/enter your research topic/i), { target: { value: validTopic } });
    const form = screen.getByPlaceholderText(/enter your research topic/i).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));

    resolveA(buildFypResponse({ risk: 'LOW', maxSimilarity: 0.11 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /checking similarity/i })).toBeDisabled());
    expect(screen.queryByTestId('student-results-container')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    resolveB(buildFypResponse({ risk: 'HIGH', maxSimilarity: 0.91 }));
    expect(await screen.findByTestId('max-similarity')).toHaveTextContent('0.910');
    expect(screen.getByTestId('risk-title')).toHaveTextContent('High Risk');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders HIGH result through ResultsDisplay without blocking anything', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({
      risk: 'HIGH',
      maxSimilarity: 0.88,
      matches: [
        {
          id: 2,
          title: 'Public Health Surveillance Systems',
          supervisor: 'Dr. Similar',
          year: '2024/2025',
          semantic_score: 0.84
        }
      ]
    }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('High Risk');
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('shows API, server, and network error text', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Similarity service failed.' }
      }
    });
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByText(/similarity service failed/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue(validTopic);
    expect(screen.getByLabelText(/research area/i)).toHaveValue(validCategory);
    expect(screen.getByLabelText(/keywords/i)).toHaveValue(validKeywords);
    expect(screen.getAllByRole('button', { name: /check similarity/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /check similarity/i })).toBeEnabled();

    axios.post.mockRejectedValueOnce({
      request: {}
    });

    await user.click(screen.getByRole('button', { name: /check similarity/i }));

    expect(await screen.findByText(/no response from server/i)).toBeInTheDocument();
  });

  it('resets result and error with Check Another Topic', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 0.10 }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check another topic/i }));

    expect(screen.queryByTestId('student-results-container')).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting topic check/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveFocus();
  });

  it('does not call lecturer submission endpoints or snapshot endpoints', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse());
    renderCheckMyTopicPage();

    await submitTopic(user);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });

    expect(postedPaths()).toEqual(['/api/similarity/check']);
    expect(postedPaths().some(path => path.includes('/lecturer/submissions'))).toBe(false);
    expect(postedPaths().some(path => path.includes('similarity-snapshots'))).toBe(false);
  });

  it('does not expose submission decision UI or mutate submissions', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'HIGH', maxSimilarity: 0.92 }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(postedPaths().some(path => path.includes('/submissions'))).toBe(false);
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/decision rationale/i)).not.toBeInTheDocument();
  });
});
