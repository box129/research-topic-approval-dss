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
const validPopulation = 'Undergraduate students';
const validLocation = 'Osogbo, Osun State';
const validStudyFocus = 'Barriers to preventive-health information access';

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
  fireEvent.change(screen.getByLabelText(/population/i), { target: { value: validPopulation } });
  fireEvent.change(screen.getByLabelText(/location/i), { target: { value: validLocation } });
  fireEvent.change(screen.getByLabelText(/study focus/i), { target: { value: validStudyFocus } });
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
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Lower similarity');
    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('0.180');
    expect(screen.getByText(/machine learning in public health/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/enter your research topic/i)).not.toBeInTheDocument();
    expect(screen.getByText(/temporary browser state only/i)).toBeInTheDocument();
  });

  it('renders an advisory no-match state without uniqueness or clearance claims', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue(buildFypResponse({ risk: 'LOW', maxSimilarity: 0 }));
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByTestId('no-matches')).toHaveTextContent(/no stored records were returned by this check/i);
    expect(screen.getByTestId('no-matches')).toHaveTextContent(/does not establish that the topic is new or original/i);
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
    expect(screen.queryByTestId('classification-block')).not.toBeInTheDocument();
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
    expect(await screen.findByTestId('provenance-cosine')).toHaveTextContent('0.910');
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Higher similarity');
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
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Higher similarity');
    // Board A: the evidence wrapper itself rests neutral — the result surface
    // must never regain semantic emerald/green resting colour. (Institutional
    // green elsewhere on the page is legitimate branding and untested here.)
    expect(screen.getByTestId('student-results-container').className).not.toMatch(/emerald|green|mint/i);
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
    expect(screen.getByLabelText(/population/i)).toHaveValue(validPopulation);
    expect(screen.getByLabelText(/location/i)).toHaveValue(validLocation);
    expect(screen.getByLabelText(/study focus/i)).toHaveValue(validStudyFocus);
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
    // Board C: the generic pristine placeholder is deleted — the form itself
    // is the pristine state, so reset returns straight to it.
    expect(screen.queryByText(/awaiting topic check/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue('');
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

describe('CheckMyTopicPage — Board C failure/absence states', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function semanticUnavailableRejection() {
    return {
      response: {
        status: 503,
        data: buildFypResponse({ status: 'semantic_unavailable' }).data
      }
    };
  }

  async function reachC2(user) {
    axios.post.mockRejectedValueOnce(semanticUnavailableRejection());
    await submitTopic(user);
    return await screen.findByTestId('semantic-unavailable');
  }

  it('pristine page renders the form and rail with no generic placeholder panel', () => {
    renderCheckMyTopicPage();

    expect(screen.getByPlaceholderText(/enter your research topic/i)).toBeInTheDocument();
    const railHeading = screen.getByText(/what this check considers/i);
    // Guidance rests neutral: instructional headings never wear success or
    // institutional green inside the checker guidance rail.
    expect(railHeading.className).toContain('text-text-primary');
    expect(railHeading.className).not.toMatch(/green|emerald|success/i);
    expect(screen.queryByText(/awaiting topic check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/complete the form to view advisory similarity guidance/i)).not.toBeInTheDocument();
  });

  it('semantic unavailable renders only the C2 failure state, never the old placeholder', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    expect(screen.getByTestId('semantic-unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/awaiting topic check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/complete the form to view advisory similarity guidance/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-display')).not.toBeInTheDocument();
  });

  it('C2 copy leads with the cause and carries the frozen sentences', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    expect(screen.getByText('Check could not run')).toBeInTheDocument();
    expect(screen.getByText(/similarity checking is temporarily unavailable, so this check could not run/i)).toBeInTheDocument();
    expect(screen.getByText(/no similarity result was produced and no classification has been assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is wrong with your topic/i)).toBeInTheDocument();
    expect(screen.getByText(/your proposal has not been lost/i)).toBeInTheDocument();
    expect(screen.getByText(/if it keeps failing, contact your department administrator/i)).toBeInTheDocument();
    expect(screen.getByTestId('retry-check')).toHaveTextContent('Try the check again');
    expect(screen.getByTestId('edit-proposal')).toHaveTextContent('Edit proposal');
  });

  it('C2 exposes no provider or internal vocabulary to the student', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    const pageText = document.body.textContent;
    expect(pageText).not.toMatch(/voyage|api key|embedding service|semantic service|semantic analysis|semantic similarity unavailable/i);
    expect(pageText).not.toMatch(/\bAPI\b/);
    expect(pageText).not.toMatch(/\b503\b/);
  });

  it('C2 retains the checked proposal visibly with truthful optional-field fallbacks', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    const c2 = await reachC2(user);

    expect(screen.getByText('Your proposal, retained')).toBeInTheDocument();
    expect(screen.getByTestId('retained-topic')).toHaveTextContent(validTopic);
    expect(c2).toHaveTextContent(validPopulation);
    expect(c2).toHaveTextContent(validLocation);
    expect(c2).toHaveTextContent(validStudyFocus);
    expect(screen.getByText(/temporary browser state only\. this proposal was not saved or submitted\./i)).toBeInTheDocument();
  });

  it('C2 shows Not specified for blank optional fields', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce(semanticUnavailableRejection());
    renderCheckMyTopicPage();

    fireEvent.change(screen.getByPlaceholderText(/enter your research topic/i), { target: { value: validTopic } });
    await user.click(screen.getByRole('button', { name: /check similarity/i }));

    const c2 = await screen.findByTestId('semantic-unavailable');
    expect(c2.textContent.match(/Not specified/g)).toHaveLength(3);
  });

  it('retry posts the identical retained payload without resetting first', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    axios.post.mockRejectedValueOnce(semanticUnavailableRejection());
    await user.click(screen.getByTestId('retry-check'));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(axios.post.mock.calls[1][0]).toBe('/api/similarity/check');
    expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  });

  it('repeated semantic failure remains in C2 with the proposal still retained', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    axios.post.mockRejectedValueOnce(semanticUnavailableRejection());
    await user.click(screen.getByTestId('retry-check'));

    expect(await screen.findByTestId('semantic-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('retained-topic')).toHaveTextContent(validTopic);
    expect(screen.queryByText(/awaiting topic check/i)).not.toBeInTheDocument();
  });

  it('successful retry renders the normal Board A result', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    axios.post.mockResolvedValueOnce(buildFypResponse({ risk: 'MEDIUM', maxSimilarity: 0.62 }));
    await user.click(screen.getByTestId('retry-check'));

    expect(await screen.findByTestId('student-results-container')).toBeInTheDocument();
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Moderate similarity');
    expect(screen.queryByTestId('semantic-unavailable')).not.toBeInTheDocument();
  });

  it('generic retry failure keeps the retained proposal in the remounted form', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    axios.post.mockRejectedValueOnce({ request: {} });
    await user.click(screen.getByTestId('retry-check'));

    expect(await screen.findByText(/no response from server/i)).toBeInTheDocument();
    expect(screen.queryByTestId('semantic-unavailable')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue(validTopic);
    expect(screen.getByLabelText(/population/i)).toHaveValue(validPopulation);
    expect(screen.getByLabelText(/location/i)).toHaveValue(validLocation);
    expect(screen.getByLabelText(/study focus/i)).toHaveValue(validStudyFocus);
  });

  it('Edit proposal restores all four checker fields and focuses the topic field', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    await user.click(screen.getByTestId('edit-proposal'));

    expect(screen.queryByTestId('semantic-unavailable')).not.toBeInTheDocument();
    const topicInput = screen.getByPlaceholderText(/enter your research topic/i);
    expect(topicInput).toHaveValue(validTopic);
    expect(screen.getByLabelText(/population/i)).toHaveValue(validPopulation);
    expect(screen.getByLabelText(/location/i)).toHaveValue(validLocation);
    expect(screen.getByLabelText(/study focus/i)).toHaveValue(validStudyFocus);
    await waitFor(() => expect(topicInput).toHaveFocus());
  });

  it('C2 offers no destructive default: Check Another Topic is not rendered there', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    expect(screen.queryByRole('button', { name: /check another topic/i })).not.toBeInTheDocument();
  });

  it('C2 retry rests in ink and never in success or approval colour', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    await reachC2(user);

    const retry = screen.getByTestId('retry-check');
    expect(retry.className).toContain('bg-text-primary');
    expect(retry.className).toContain('min-h-11');
    // Resting classes only: the application focus ring may keep its standard
    // colour (C0-5), so focus: variants are excluded from the neutrality walk.
    const restingClasses = retry.className.split(/\s+/).filter((cls) => !cls.startsWith('focus:')).join(' ');
    expect(restingClasses).not.toMatch(/green|emerald|success|approval/i);
    const edit = screen.getByTestId('edit-proposal');
    expect(edit.className).toContain('border');
    expect(edit.className).toContain('min-h-11');
  });

  it('C2 carries the amber edge rule without a filled warning surface or icon', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    const section = await reachC2(user);

    const panel = section.firstChild;
    expect(panel.className).toContain('border-l-[3px]');
    expect(panel.className).toContain('border-l-brand-gold');
    expect(panel.className).toContain('bg-white');
    expect(panel.className).not.toMatch(/bg-feedback-warning|bg-amber|bg-yellow|border-dashed/);
    expect(section.querySelector('svg')).toBeNull();
  });

  it('C2 receives focus on entry and is the only alert surface', async () => {
    const user = userEvent.setup();
    renderCheckMyTopicPage();
    const section = await reachC2(user);

    await waitFor(() => expect(section).toHaveFocus());
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const retry = screen.getByTestId('retry-check');
    const edit = screen.getByTestId('edit-proposal');
    expect(retry.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('generic first-submit errors stay on the danger surface with the form available', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { status: 500, statusText: 'Internal Server Error', data: { message: 'Similarity service failed.' } }
    });
    renderCheckMyTopicPage();

    await submitTopic(user);

    expect(await screen.findByText(/similarity service failed/i)).toBeInTheDocument();
    expect(screen.queryByTestId('semantic-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText(/check could not run/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your research topic/i)).toHaveValue(validTopic);
    expect(screen.getByRole('button', { name: /check similarity/i })).toBeEnabled();
  });
});
