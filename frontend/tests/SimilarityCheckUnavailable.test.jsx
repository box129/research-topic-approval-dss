import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimilarityCheckUnavailable from '../src/components/features/Results/SimilarityCheckUnavailable';

const proposal = {
  topic: 'Evaluation of community pharmacy counselling on rational antibiotic use among adults in Ede',
  population: 'Adults attending community pharmacies',
  location: 'Ede, Osun State',
  studyFocus: 'Effect of counselling on rational antibiotic use'
};

describe('SimilarityCheckUnavailable — frozen C2 component', () => {
  let onRetry;
  let onEdit;

  beforeEach(() => {
    onRetry = vi.fn();
    onEdit = vi.fn();
  });

  function renderC2(overrides = {}) {
    return render(
      <SimilarityCheckUnavailable proposal={overrides.proposal ?? proposal} onRetry={onRetry} onEdit={onEdit} />
    );
  }

  it('renders the frozen cause-first copy in order', () => {
    const { container } = renderC2();

    const text = container.textContent;
    const order = [
      'Check could not run',
      'Similarity checking is temporarily unavailable, so this check could not run.',
      'No similarity result was produced and no classification has been assigned.',
      'Nothing is wrong with your topic — this is a fault in the checking service, and your proposal has not been lost.',
      'If it keeps failing, contact your department administrator.',
      'Your proposal, retained',
      'Temporary browser state only. This proposal was not saved or submitted.'
    ];
    let lastIndex = -1;
    for (const sentence of order) {
      const index = text.indexOf(sentence);
      expect(index, sentence).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('encodes only C2 semantics: no provider vocabulary, no icon, no dashed empty-state shell', () => {
    const { container } = renderC2();

    expect(container.textContent).not.toMatch(/voyage|api|503|semantic/i);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('[class*="border-dashed"]')).toBeNull();

    const panel = container.firstChild;
    expect(panel.className).toContain('border-l-[3px]');
    expect(panel.className).toContain('border-l-brand-gold');
    expect(panel.className).toContain('bg-white');
    expect(panel.className).not.toMatch(/bg-feedback-warning|bg-amber|bg-yellow|bg-red|bg-brand-green/);
  });

  it('fires the retry and edit callbacks from their dedicated actions', async () => {
    const user = userEvent.setup();
    renderC2();

    await user.click(screen.getByTestId('retry-check'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('edit-proposal'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the retained proposal fields and truthful Not specified fallbacks', () => {
    renderC2({ proposal: { topic: proposal.topic } });

    expect(screen.getByTestId('retained-topic')).toHaveTextContent(proposal.topic);
    expect(screen.getAllByText('Not specified')).toHaveLength(3);
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Study focus')).toBeInTheDocument();
  });
});
