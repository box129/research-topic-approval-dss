import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ResultsDisplay from '../src/components/features/Results/ResultsDisplay';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../src/api/client', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

const { runSimilarityCheck } = await import('../src/api/similarity');
const axios = (await import('axios')).default;

function backendPayload(matchOverrides = {}) {
  return {
    data: {
      status: 'success',
      semanticAvailable: true,
      semanticProvider: 'voyage',
      data: {
        overall_risk: 'MEDIUM',
        max_similarity: 0.66,
        corpus_size: 120,
        recommendation: 'Review the closest matches before submitting.',
        matches: [{
          id: 42,
          title: 'Malaria prevention knowledge among rural caregivers',
          category: 'Public Health',
          collection: 'HISTORICAL',
          session_year: '2021/2022',
          supervisor_name: 'Dr A. Adeyemi',
          population: 'Rural caregivers',
          location: 'Osun State',
          study_focus: 'Preventive knowledge and practice',
          semantic_score: 0.66,
          similarity_class: 'MEDIUM',
          ...matchOverrides
        }]
      }
    }
  };
}

describe('similarity context reaches the client', () => {
  it('carries the approved context fields through the API mapper', async () => {
    axios.post.mockResolvedValue(backendPayload());

    const { results } = await runSimilarityCheck({ topic: 'A proposed topic' });
    const [match] = results.tier1_matches;

    expect(match).toMatchObject({
      id: 42,
      topic_title: 'Malaria prevention knowledge among rural caregivers',
      category: 'Public Health',
      session_year: '2021/2022',
      supervisor_name: 'Dr A. Adeyemi',
      population: 'Rural caregivers',
      location: 'Osun State',
      study_focus: 'Preventive knowledge and practice',
      semantic_score: 0.66,
      similarity_class: 'MEDIUM'
    });
  });

  it('normalises absent context to null rather than undefined', async () => {
    axios.post.mockResolvedValue(backendPayload({
      session_year: null,
      supervisor_name: null,
      population: null,
      location: null,
      study_focus: null
    }));

    const { results } = await runSimilarityCheck({ topic: 'A proposed topic' });
    const [match] = results.tier1_matches;

    for (const field of ['session_year', 'supervisor_name', 'population', 'location', 'study_focus']) {
      expect(match[field]).toBeNull();
    }
  });
});

const contextResults = {
  risk_level: 'MEDIUM',
  max_similarity: 0.66,
  semantic_available: true,
  recommendation: 'Review the closest matches before submitting.',
  tier1_matches: [{
    id: 42,
    topic_title: 'Malaria prevention knowledge among rural caregivers',
    collection: 'HISTORICAL',
    session_year: '2021/2022',
    supervisor_name: 'Dr A. Adeyemi',
    population: 'Rural caregivers',
    location: 'Osun State',
    study_focus: 'Preventive knowledge and practice',
    semantic_score: 0.66,
    similarity_class: 'MEDIUM'
  }],
  tier2_matches: [],
  tier3_matches: []
};

describe('similarity context display', () => {
  it('renders supervisor, session, source tier and research context when the record has them', () => {
    render(<ResultsDisplay results={contextResults} />);

    const record = screen.getByTestId('record-0');
    const meta = within(record).getByTestId('record-meta-0');
    expect(meta).toHaveTextContent('Dr A. Adeyemi');
    expect(meta).toHaveTextContent('2021/2022 session');
    expect(meta).toHaveTextContent('previous-session record');

    const context = within(record).getByTestId('record-context-0');
    expect(within(context).getByTestId('record-population-0')).toHaveTextContent('Rural caregivers');
    expect(within(context).getByTestId('record-location-0')).toHaveTextContent('Osun State');
    expect(within(context).getByTestId('record-study-focus-0')).toHaveTextContent('Preventive knowledge and practice');
  });

  it('degrades gracefully when a record carries no context at all', () => {
    render(<ResultsDisplay results={{
      ...contextResults,
      tier1_matches: [{
        id: 43,
        topic_title: 'A stored topic with no recorded context',
        collection: 'HISTORICAL',
        session_year: null,
        supervisor_name: null,
        population: null,
        location: null,
        study_focus: null,
        semantic_score: 0.51,
        similarity_class: 'LOW'
      }]
    }} />);

    const record = screen.getByTestId('record-0');
    expect(within(record).getByText(/a stored topic with no recorded context/i)).toBeInTheDocument();
    // No empty rows, no placeholder noise.
    expect(within(record).queryByTestId('record-context-0')).not.toBeInTheDocument();
    expect(record.textContent).not.toMatch(/null|undefined|N\/A/);
  });

  it('renders only the context fields that are actually present', () => {
    render(<ResultsDisplay results={{
      ...contextResults,
      tier1_matches: [{
        ...contextResults.tier1_matches[0],
        population: 'Rural caregivers',
        location: null,
        study_focus: null
      }]
    }} />);

    const context = screen.getByTestId('record-context-0');
    expect(within(context).getByTestId('record-population-0')).toHaveTextContent('Rural caregivers');
    expect(within(context).queryByTestId('record-location-0')).not.toBeInTheDocument();
    expect(within(context).queryByTestId('record-study-focus-0')).not.toBeInTheDocument();
    expect(context.textContent).not.toMatch(/null|undefined|N\/A/);
  });

  it('keeps the plain-language classification leading and the raw cosine subordinate', () => {
    render(<ResultsDisplay results={contextResults} />);

    const record = screen.getByTestId('record-0');
    // The backend classification leads as a plain-language chip; the raw
    // cosine appears only as subordinate labelled provenance in the meta line.
    expect(within(record).getByTestId('record-class-0')).toHaveTextContent('Moderate similarity');
    expect(within(record).getByTestId('record-cosine-0')).toHaveTextContent('cosine 0.660');
    expect(record.textContent).not.toMatch(/%/);
  });
});

describe('research context layout', () => {
  // Board A: context fields render as labelled lines, one per row, at every
  // appearance — so a long phrase never wraps mid-label in the lecturer
  // checker's narrow results column.
  it.each([['lecturer-checker'], ['student-checker'], ['default']])('stacks the context fields as labelled lines in the %s appearance', (appearance) => {
    render(<ResultsDisplay appearance={appearance === 'default' ? undefined : appearance} results={contextResults} />);

    const context = screen.getByTestId('record-context-0');
    expect(within(context).getByTestId('record-population-0')).toHaveTextContent('Rural caregivers');
    expect(within(context).getByTestId('record-location-0')).toHaveTextContent('Osun State');
    expect(context.className).not.toMatch(/grid-cols-2/);
  });
});
