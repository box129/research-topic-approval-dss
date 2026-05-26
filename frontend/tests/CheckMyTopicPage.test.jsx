import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import CheckMyTopicPage from '../src/pages/student/CheckMyTopicPage';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

const validTopic = 'Machine learning methods for public health surveillance systems';
const validKeywords = 'machine learning, public health';
const validCategory = 'Epidemiology';

function renderCheckMyTopicPage() {
  return render(<CheckMyTopicPage />);
}

function buildFypResponse({ risk = 'LOW', maxSimilarity = 24, status = 'success', matches = [] } = {}) {
  return {
    data: {
      status,
      data: {
        overall_risk: risk,
        max_similarity: maxSimilarity,
        recommendation: `${risk} similarity guidance from backend.`,
        tier1_historical: matches,
        tier2_current: [],
        tier3_under_review: []
      }
    }
  };
}

async function submitTopic(user) {
  await user.type(screen.getByPlaceholderText(/enter your research topic/i), validTopic);
  await user.selectOptions(screen.getByLabelText(/research area/i), validCategory);
  await user.type(screen.getByLabelText(/keywords/i), validKeywords);
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
    expect(screen.getByText(/pre-check only/i)).toBeInTheDocument();
    expect(screen.getByText(/does not submit your topic for lecturer approval/i)).toBeInTheDocument();
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
    expect(screen.getByText(/your topic is being compared against existing records/i)).toBeInTheDocument();

    resolveRequest(buildFypResponse());
    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
  });

  it('renders LOW result through ResultsDisplay', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({
      risk: 'LOW',
      maxSimilarity: 18,
      matches: [
        {
          id: 1,
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
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('Low Risk');
    expect(screen.getByTestId('max-similarity')).toHaveTextContent('18%');
    expect(screen.getByText(/machine learning in public health/i)).toBeInTheDocument();
  });

  it('renders MEDIUM partial_success result through ResultsDisplay', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({
      risk: 'MEDIUM',
      maxSimilarity: 62,
      status: 'partial_success'
    }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('risk-title')).toHaveTextContent('Medium Risk');
    expect(screen.getByTestId('sbert-warning')).toBeInTheDocument();
    expect(screen.getByText(/semantic analysis is temporarily unavailable/i)).toBeInTheDocument();
  });

  it('renders HIGH result through ResultsDisplay without blocking anything', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({
      risk: 'HIGH',
      maxSimilarity: 88,
      matches: [
        {
          id: 2,
          title: 'Public Health Surveillance Systems',
          supervisor: 'Dr. Similar',
          year: '2024/2025',
          jaccard: 88,
          tfidf: 80,
          sbert: 84
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

    axios.post.mockRejectedValueOnce({
      request: {}
    });

    await user.type(screen.getByPlaceholderText(/enter your research topic/i), validTopic);
    await user.click(screen.getByRole('button', { name: /check similarity/i }));

    expect(await screen.findByText(/no response from server/i)).toBeInTheDocument();
  });

  it('resets result and error with Check Another Topic', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 10 }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check another topic/i }));

    expect(screen.queryByTestId('student-results-container')).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting topic check/i)).toBeInTheDocument();
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
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'HIGH', maxSimilarity: 92 }));
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
