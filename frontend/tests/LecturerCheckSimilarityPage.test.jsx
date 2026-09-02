import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import CheckSimilarityPage from '../src/pages/lecturer/CheckSimilarityPage';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({ post: vi.fn() }))
  }
}));

const validTopic = 'Machine learning methods for public health surveillance systems';
const validPopulation = 'Undergraduate students';
const validLocation = 'Osogbo, Osun State';
const validStudyFocus = 'Barriers to preventive-health information access';

function renderCheckSimilarityPage() {
  return render(<CheckSimilarityPage />);
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
  const topicInput = screen.getByPlaceholderText(/enter your research topic/i);
  const populationInput = screen.getByLabelText(/population/i);
  const locationInput = screen.getByLabelText(/location/i);
  const studyFocusInput = screen.getByLabelText(/study focus/i);
  const submitButton = screen.getByRole('button', { name: /check similarity/i });

  fireEvent.change(topicInput, { target: { value: validTopic } });
  fireEvent.change(populationInput, { target: { value: validPopulation } });
  fireEvent.change(locationInput, { target: { value: validLocation } });
  fireEvent.change(studyFocusInput, { target: { value: validStudyFocus } });

  await waitFor(() => {
    expect(submitButton).toBeEnabled();
  });

  await user.click(submitButton);
}

function postedPaths() {
  return axios.post.mock.calls.map(([path]) => path);
}

describe('Lecturer CheckSimilarityPage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    axios.post.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    axios.post.mockReset();
    consoleErrorSpy.mockRestore();
  });

  it('renders lecturer header, guidance, and TopicForm', () => {
    renderCheckSimilarityPage();

    expect(screen.getByRole('heading', { name: /check similarity/i })).toBeInTheDocument();
    expect(screen.getByText(/manual advisory check/i)).toBeInTheDocument();
    expect(screen.getByText(/without changing a submission, snapshot, or lecturer decision/i)).toBeInTheDocument();
    expect(screen.getByText('Advisory pre-check')).toBeInTheDocument();
    expect(screen.getByText('This check is temporary. It does not save a snapshot or change a submission or lecturer decision.')).toBeInTheDocument();
    expect(screen.queryByText('Standalone topic check')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual similarity pre-check')).not.toBeInTheDocument();
    expect(screen.queryByText(/decision write/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot saved/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check similarity/i })).toBeInTheDocument();
  });

  it('posts to the public similarity endpoint with the exact TopicForm payload', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse());
    renderCheckSimilarityPage();

    await submitTopic(user);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/similarity/check',
        {
          topic: validTopic,
          population: validPopulation,
          location: validLocation,
          studyFocus: validStudyFocus
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
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(screen.getByRole('button', { name: /checking similarity/i })).toBeDisabled();
    expect(screen.getByText(/the topic is being compared against existing records/i)).toBeInTheDocument();

    resolveRequest(buildFypResponse());
    expect(await screen.findByTestId('results-container')).toBeInTheDocument();
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
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('results-container')).toBeInTheDocument();
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Lower similarity');
    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('0.180');
    expect(screen.getByText(/machine learning in public health/i)).toBeInTheDocument();
  });

  it('renders an explicit unavailable state without a risk or fallback claim', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValue({
      response: {
        status: 503,
        data: buildFypResponse({ status: 'semantic_unavailable' }).data
      }
    });
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('semantic-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('classification-block')).not.toBeInTheDocument();
    expect(screen.queryByText(/exact match|term weighting|sbert/i)).not.toBeInTheDocument();
  });

  it('renders HIGH result through ResultsDisplay without blocking or deciding', async () => {
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
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('results-container')).toBeInTheDocument();
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Higher similarity');
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /block/i })).not.toBeInTheDocument();
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
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByText(/similarity service failed/i)).toBeInTheDocument();

    axios.post.mockRejectedValueOnce({
      request: {}
    });

    await submitTopic(user);

    expect(await screen.findByText(/no response from server/i)).toBeInTheDocument();

    axios.post.mockRejectedValueOnce(new Error('Invalid response format from server'));

    await submitTopic(user);

    expect(await screen.findByText(/invalid response format from server/i)).toBeInTheDocument();
  });

  it('reset clears the local result and error state', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 0.10 }));
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('results-container')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check another topic/i }));

    expect(screen.queryByTestId('results-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-display')).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting manual check/i)).toBeInTheDocument();
  });

  it('does not call lecturer submission endpoints or snapshot endpoints', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse());
    renderCheckSimilarityPage();

    await submitTopic(user);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });

    expect(postedPaths()).toEqual(['/api/similarity/check']);
    expect(postedPaths().some(path => path.includes('/lecturer/submissions'))).toBe(false);
    expect(postedPaths().some(path => path.includes('snapshot'))).toBe(false);
  });

  it('does not expose decision UI or mutate submissions', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'HIGH', maxSimilarity: 0.92 }));
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('results-container')).toBeInTheDocument();
    expect(postedPaths().some(path => path.includes('/submissions'))).toBe(false);
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/decision rationale/i)).not.toBeInTheDocument();
  });
});

describe('Lecturer CheckSimilarityPage — Board C field retention and plain-language failure', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    axios.post.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    axios.post.mockReset();
    consoleErrorSpy.mockRestore();
  });

  function expectTypedProposalRetained() {
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue(validTopic);
    expect(screen.getByLabelText(/population/i)).toHaveValue(validPopulation);
    expect(screen.getByLabelText(/location/i)).toHaveValue(validLocation);
    expect(screen.getByLabelText(/study focus/i)).toHaveValue(validStudyFocus);
  }

  it('semantic unavailable never clears the typed proposal', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { status: 503, data: buildFypResponse({ status: 'semantic_unavailable' }).data }
    });
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('semantic-unavailable')).toBeInTheDocument();
    expectTypedProposalRetained();
  });

  it('generic request failure never clears the typed proposal', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { status: 500, statusText: 'Internal Server Error', data: { message: 'Similarity service failed.' } }
    });
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('error-display')).toBeInTheDocument();
    expectTypedProposalRetained();
  });

  it('a successful result still clears the form under the existing success contract', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 0.2 }));
    renderCheckSimilarityPage();

    await submitTopic(user);

    expect(await screen.findByTestId('results-container')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue('');
  });

  it('semantic-unavailable offers a truthful Dismiss action that preserves the typed proposal', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { status: 503, data: buildFypResponse({ status: 'semantic_unavailable' }).data }
    });
    renderCheckSimilarityPage();

    await submitTopic(user);

    const panel = await screen.findByTestId('semantic-unavailable');
    expectTypedProposalRetained();
    // The action only dismisses the failure message, so it must not claim to
    // start over: "Check Another Topic" would be a false label here.
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(panel).not.toHaveTextContent('Check Another Topic');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByTestId('semantic-unavailable')).not.toBeInTheDocument();
    expectTypedProposalRetained();
  });

  it('lecturer semantic-unavailable copy is plain similarity-check language without internal vocabulary', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { status: 503, data: buildFypResponse({ status: 'semantic_unavailable' }).data }
    });
    renderCheckSimilarityPage();

    await submitTopic(user);

    const panel = await screen.findByTestId('semantic-unavailable');
    expect(panel).toHaveTextContent('Check could not run');
    expect(panel).toHaveTextContent('Similarity checking is temporarily unavailable. Your topic remains in the form so you can try again.');
    expect(panel.textContent).not.toMatch(/voyage|semantic analysis|semantic similarity unavailable|api key/i);
    expect(panel.textContent).not.toMatch(/\b503\b/);
  });
});
