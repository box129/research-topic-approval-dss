import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultsDisplay from '../src/components/features/Results/ResultsDisplay';

// Board A regression suite: the similarity evidence system communicates what
// the system found, never what anyone should decide. HIGH/MEDIUM/LOW are
// similarity classifications — not approval, rejection, revision, danger or
// risk verdicts.

function buildMatch(overrides = {}) {
  return {
    id: 1,
    topic_title: 'Assessment of Health Education Campaigns on Malaria Prevention',
    supervisor_name: 'Dr. Adeyemi',
    session_year: '2022/2023',
    collection: 'HISTORICAL',
    population: 'Undergraduate students',
    location: 'Osogbo',
    study_focus: 'Effect of health education campaigns',
    semantic_score: 0.7207,
    similarity_class: 'HIGH',
    ...overrides
  };
}

function buildResults(overrides = {}) {
  return {
    risk_level: 'HIGH',
    max_similarity: 0.7206525778154617,
    corpus_size: 9,
    semantic_available: true,
    tier1_matches: [buildMatch()],
    tier2_matches: [],
    tier3_matches: [],
    ...overrides
  };
}

const FORBIDDEN_RISK_WORDING = /risk/i;
const WARNING_ICON = /⚠/;

describe('Board A — overall similarity classification', () => {
  it.each([
    ['HIGH', 'Higher similarity'],
    ['MEDIUM', 'Moderate similarity'],
    ['LOW', 'Lower similarity']
  ])('renders overall %s as the neutral classification "%s" with the API token, never risk wording', (token, label) => {
    const { container } = render(
      <ResultsDisplay results={buildResults({ risk_level: token, tier1_matches: [buildMatch({ similarity_class: token })] })} />
    );

    const chip = screen.getByTestId('similarity-classification');
    expect(chip).toHaveTextContent(label);
    expect(chip).toHaveTextContent(token);
    expect(screen.getByText('Similarity classification')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(FORBIDDEN_RISK_WORDING);
    expect(container.textContent).not.toMatch(WARNING_ICON);
  });

  it('keeps the classification primary and the raw cosine subordinate technical provenance', () => {
    render(<ResultsDisplay results={buildResults()} />);

    // The cosine lives in the provenance strip, labelled as what it is, at
    // three decimals — never a percentage and never a display figure.
    const provenance = screen.getByTestId('check-provenance');
    expect(within(provenance).getByText('Cosine, top record')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('0.721');
    expect(provenance).toHaveTextContent('not a percentage of duplication, originality or probability');
    expect(provenance.textContent).not.toMatch(/%/);
    expect(provenance.textContent).not.toMatch(/confidence|probability of|accuracy/i);
  });

  it('names the consequence for HIGH in the lead line without prescribing an academic action', () => {
    const { container } = render(
      <ResultsDisplay
        appearance="student-checker"
        results={buildResults({
          tier1_matches: [
            buildMatch({ id: 1, similarity_class: 'HIGH', semantic_score: 0.72 }),
            buildMatch({ id: 2, topic_title: 'Second related record', similarity_class: 'HIGH', semantic_score: 0.7 }),
            buildMatch({ id: 3, topic_title: 'Third related record', similarity_class: 'HIGH', semantic_score: 0.69 })
          ]
        })}
      />
    );

    expect(screen.getByTestId('classification-lead')).toHaveTextContent(
      'Three stored records are closely related to this proposal. Read them before deciding whether to submit.'
    );
    // The system reports; it never prescribes an academic action. (The
    // boundary line legitimately *denies* approving/rejecting — the ban is on
    // directive machine advice.)
    expect(container.textContent).not.toMatch(
      /request (topic )?modification|coordinate with|we recommend|consider revising|revise your topic|check with colleagues|proceed(ing)? (to|with)/i
    );
  });

  it('carries the human-authority boundary once on the student surface', () => {
    render(<ResultsDisplay appearance="student-checker" results={buildResults()} />);

    const boundaries = screen.getAllByTestId('boundary-line');
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toHaveTextContent(
      'It does not approve, reject or certify originality — your lecturer makes the academic decision.'
    );
  });

  it('renders LOW with the originality denial promoted into the lead block', () => {
    render(
      <ResultsDisplay
        appearance="student-checker"
        results={buildResults({
          risk_level: 'LOW',
          max_similarity: 0.2673686509412847,
          tier1_matches: [buildMatch({ similarity_class: 'LOW', semantic_score: 0.2674, topic_title: 'Machine Learning Algorithms for Stock Market Prediction' })]
        })}
      />
    );

    expect(screen.getByTestId('classification-lead')).toHaveTextContent('No stored record is closely related to this proposal.');
    expect(screen.getByTestId('originality-denial')).toHaveTextContent('This does not establish that the topic is new or original.');
    expect(screen.getByText('The nearest records found — none is closely related.')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('0.267');
  });
});

describe('Board A — neutral treatment (no verdict semantics)', () => {
  it.each(['HIGH', 'MEDIUM', 'LOW'])('gives %s no red/amber/green verdict colouring', (token) => {
    render(<ResultsDisplay results={buildResults({ risk_level: token, tier1_matches: [buildMatch({ similarity_class: token })] })} />);

    const chipGroup = screen.getByTestId('similarity-classification');
    const chipClasses = Array.from(chipGroup.querySelectorAll('span')).map((el) => el.className).join(' ');
    expect(chipClasses).not.toMatch(/red|rose|amber|yellow|orange|green|emerald|risk|danger|success|warning/i);
  });

  it('renders ordinary evidence with rank ordinals and no warning iconography', () => {
    const { container } = render(
      <ResultsDisplay
        results={buildResults({
          tier1_matches: [
            buildMatch({ id: 1, similarity_class: 'HIGH' }),
            buildMatch({ id: 2, topic_title: 'Second record', similarity_class: 'LOW', semantic_score: 0.31 })
          ]
        })}
      />
    );

    expect(container.textContent).not.toMatch(WARNING_ICON);
    expect(screen.getByTestId('record-0')).toHaveTextContent('01');
    expect(screen.getByTestId('record-1')).toHaveTextContent('02');
    // "Match" is not used for a nearest neighbour.
    expect(container.textContent).not.toMatch(/high match|moderate match|low match|very high match/i);
    expect(screen.getByText('Closest stored records')).toBeInTheDocument();
  });

  it('exposes no approve/reject/decision controls', () => {
    render(<ResultsDisplay results={buildResults()} />);

    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
  });
});

describe('Board A — N-3: backend classification is the only per-record authority', () => {
  it('renders similarity_class MEDIUM for a 0.58 score the old local bands called "Low Match"', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          risk_level: 'MEDIUM',
          max_similarity: 0.58,
          tier1_matches: [buildMatch({ semantic_score: 0.58, similarity_class: 'MEDIUM' })]
        })}
      />
    );

    const recordChip = screen.getByTestId('record-class-0');
    expect(recordChip).toHaveTextContent('Moderate similarity');
    expect(recordChip).toHaveAttribute('data-classification', 'MEDIUM');
    expect(screen.queryByText(/low match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/moderate match/i)).not.toBeInTheDocument();
  });

  it('degrades a missing similarity_class to "Not classified" and never infers one from the score', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          risk_level: 'MEDIUM',
          tier1_matches: [buildMatch({ semantic_score: 0.95, similarity_class: undefined })]
        })}
      />
    );

    const recordChip = screen.getByTestId('record-class-0');
    expect(recordChip).toHaveTextContent('Not classified');
    expect(recordChip).toHaveAttribute('data-classification', 'NOT_CLASSIFIED');
    // 0.95 would have been "Very High Match" under the removed local bands.
    expect(screen.queryByText(/very high|higher similarity/i)).not.toBeInTheDocument();
  });

  it('degrades an unknown similarity_class value truthfully and neutrally', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          tier1_matches: [buildMatch({ semantic_score: 0.9, similarity_class: 'BANANAS' })]
        })}
      />
    );

    expect(screen.getByTestId('record-class-0')).toHaveTextContent('Not classified');
  });
});

describe('Board A — raw cosine truthfulness', () => {
  it('shows the per-record cosine as a raw three-decimal value labelled cosine', () => {
    render(<ResultsDisplay results={buildResults()} />);

    expect(screen.getByTestId('record-cosine-0')).toHaveTextContent('cosine 0.721');
    expect(screen.getByTestId('record-cosine-0').textContent).not.toMatch(/%/);
  });

  it('renders N/A when the top-record cosine is null', () => {
    render(<ResultsDisplay results={buildResults({ risk_level: null, max_similarity: null, corpus_size: 0, tier1_matches: [] })} />);

    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('N/A');
  });
});

describe('Board A — disclosure as emphasis (R5)', () => {
  const fiveRecords = [
    buildMatch({ id: 1, similarity_class: 'HIGH', semantic_score: 0.72 }),
    buildMatch({ id: 2, topic_title: 'Record two', similarity_class: 'MEDIUM', semantic_score: 0.66, collection: 'CURRENT_SESSION' }),
    buildMatch({ id: 3, topic_title: 'Record three', similarity_class: 'MEDIUM', semantic_score: 0.65 }),
    buildMatch({ id: 4, topic_title: 'Record four', similarity_class: 'MEDIUM', semantic_score: 0.6 }),
    buildMatch({ id: 5, topic_title: 'Record five', similarity_class: 'LOW', semantic_score: 0.4 })
  ];

  it('opens every record for a HIGH result', () => {
    render(<ResultsDisplay results={buildResults({ risk_level: 'HIGH', tier1_matches: fiveRecords })} />);

    expect(screen.getAllByTestId(/^record-\d+$/)).toHaveLength(5);
    expect(screen.queryByTestId('show-more-records')).not.toBeInTheDocument();
  });

  it('opens only the top record for MEDIUM with a keyboard-operable visible-count disclosure', async () => {
    const user = userEvent.setup();
    render(<ResultsDisplay results={buildResults({ risk_level: 'MEDIUM', tier1_matches: fiveRecords })} />);

    expect(screen.getAllByTestId(/^record-\d+$/)).toHaveLength(1);
    const disclosure = screen.getByTestId('show-more-records');
    expect(disclosure).toHaveTextContent('Show 4 more records');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    disclosure.focus();
    await user.keyboard('{Enter}');

    expect(screen.getAllByTestId(/^record-\d+$/)).toHaveLength(5);
    expect(screen.getByTestId('show-more-records')).toHaveTextContent('Show fewer records');
    expect(screen.getByTestId('show-more-records')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ranks the merged record list by the backend score and names each source tier', () => {
    render(<ResultsDisplay results={buildResults({ risk_level: 'HIGH', tier1_matches: fiveRecords })} />);

    expect(screen.getByTestId('record-title-0')).toHaveTextContent('Assessment of Health Education Campaigns');
    expect(screen.getByTestId('record-meta-1')).toHaveTextContent('current-session record');
    expect(screen.getByTestId('record-meta-0')).toHaveTextContent('previous-session record');
    expect(screen.getByText('4 from previous sessions · 1 from the current session')).toBeInTheDocument();
  });

  it('labels under-review provenance truthfully', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          risk_level: 'MEDIUM',
          tier1_matches: [],
          tier3_matches: [buildMatch({
            id: 8,
            topic_title: 'Under-review public health topic',
            supervisor_name: 'Dr. Reviewing Lecturer',
            session_year: '2026-08-05',
            collection: 'UNDER_REVIEW',
            semantic_score: 0.64,
            similarity_class: 'MEDIUM',
            population: null,
            location: null,
            study_focus: null
          })]
        })}
      />
    );

    const meta = screen.getByTestId('record-meta-0');
    expect(meta).toHaveTextContent('Reviewing lecturer: Dr. Reviewing Lecturer');
    expect(meta).toHaveTextContent('review started 2026-08-05');
    expect(meta).toHaveTextContent('under-review record');
    expect(meta).not.toHaveTextContent(/2026-08-05 session/);
  });
});

describe('Board A — record context provenance', () => {
  it('renders only the context fields that are actually present, with no placeholder noise', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          tier1_matches: [buildMatch({ location: null, study_focus: null })]
        })}
      />
    );

    const context = screen.getByTestId('record-context-0');
    expect(within(context).getByTestId('record-population-0')).toHaveTextContent('Undergraduate students');
    expect(within(context).queryByTestId('record-location-0')).not.toBeInTheDocument();
    expect(within(context).queryByTestId('record-study-focus-0')).not.toBeInTheDocument();
    expect(context.textContent).not.toMatch(/null|undefined|N\/A/);
  });

  it('omits the context block entirely when a record carries no context', () => {
    render(
      <ResultsDisplay
        results={buildResults({
          tier1_matches: [buildMatch({ population: null, location: null, study_focus: null })]
        })}
      />
    );

    expect(screen.queryByTestId('record-context-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('record-0').textContent).not.toMatch(/null|undefined/);
  });
});

describe('Board A — empty corpus (A4)', () => {
  const emptyCorpusResults = buildResults({
    risk_level: null,
    max_similarity: null,
    corpus_size: 0,
    tier1_matches: [],
    tier2_matches: [],
    tier3_matches: []
  });

  it('asserts an explicit non-classification, never LOW and never an originality claim', () => {
    const { container } = render(<ResultsDisplay results={emptyCorpusResults} />);

    expect(screen.getByTestId('empty-corpus')).toBeInTheDocument();
    const chip = screen.getByTestId('similarity-classification');
    expect(chip).toHaveTextContent('Not classified');
    expect(chip).toHaveTextContent('NOT CLASSIFIED');
    expect(chip).not.toHaveTextContent('Lower similarity');
    expect(screen.getByTestId('classification-lead')).toHaveTextContent(
      'No comparison could be made. There are no eligible stored topics to compare against.'
    );
    expect(screen.getByTestId('originality-denial')).toHaveTextContent('This does not establish that the topic is new or original.');
    expect(screen.getByText('No similarity classification has been assigned, because nothing was compared.')).toBeInTheDocument();
    // The originality denial legitimately names "new or original"; what must
    // never appear is an affirmative uniqueness/clearance/approval claim.
    expect(container.textContent).not.toMatch(/appears unique|is unique|appears original|cleared|safe to submit|approved/i);
    expect(container.textContent).not.toMatch(FORBIDDEN_RISK_WORDING);
  });

  it('shows zeroed provenance and adds no records section or filler', () => {
    render(<ResultsDisplay results={emptyCorpusResults} />);

    const provenance = screen.getByTestId('check-provenance');
    expect(provenance).toHaveTextContent('Records compared');
    expect(provenance).toHaveTextContent('0');
    expect(screen.getByTestId('provenance-cosine')).toHaveTextContent('N/A');
    expect(screen.queryByTestId('records-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-matches')).not.toBeInTheDocument();
  });

  it('carries no approval-green treatment', () => {
    const { container } = render(<ResultsDisplay results={emptyCorpusResults} />);
    expect(container.innerHTML).not.toMatch(/emerald|green-\d|mint/);
  });
});

describe('Board A — zero returned records on a comparison that ran', () => {
  it('remains distinct from the empty corpus and stays neutral without originality claims', () => {
    const { container } = render(
      <ResultsDisplay
        results={buildResults({
          risk_level: 'LOW',
          max_similarity: 0,
          corpus_size: 9,
          tier1_matches: [],
          tier2_matches: [],
          tier3_matches: []
        })}
      />
    );

    expect(screen.getByTestId('no-matches')).toHaveTextContent('No stored records were returned by this check.');
    expect(screen.getByTestId('no-matches')).toHaveTextContent('This does not establish that the topic is new or original.');
    expect(screen.queryByTestId('empty-corpus')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/emerald|green-\d|mint/);
    expect(container.textContent).not.toMatch(/unique|cleared|safe to submit/i);
  });
});
