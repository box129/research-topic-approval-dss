import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultsDisplay from '../src/components/features/Results/ResultsDisplay';

describe('ResultsDisplay Component - Redesigned', () => {
  // Mock data
  const mockLowRiskData = {
    risk_level: 'LOW',
    max_similarity: 0.45,
    semantic_available: true,
    tier1_matches: [
      {
        id: 1,
        topic_title: 'Machine Learning in Healthcare',
        supervisor_name: 'Dr. Smith',
        session_year: '2023/2024',
        status: 'Approved',
        semantic_score: 0.40
      }
    ],
    tier2_matches: [],
    tier3_matches: []
  };

  const mockHighRiskData = {
    risk_level: 'HIGH',
    max_similarity: 0.85,
    semantic_available: true,
    tier1_matches: [
      {
        id: 1,
        topic_title: 'Advanced Machine Learning Techniques',
        supervisor_name: 'Dr. Johnson',
        session_year: '2023/2024',
        status: 'In Progress',
        semantic_score: 0.88
      },
      {
        id: 2,
        topic_title: 'Deep Learning for AI Research',
        supervisor_name: 'Dr. Williams',
        session_year: '2023/2024',
        status: 'Approved',
        semantic_score: 0.80
      }
    ],
    tier2_matches: [
      {
        id: 3,
        topic_title: 'Neural Network Optimization',
        supervisor_name: 'Dr. Brown',
        session_year: '2023/2024',
        status: 'Under Review',
        semantic_score: 0.75
      }
    ],
    tier3_matches: []
  };

  describe('Risk Assessment Banner', () => {
    it('displays LOW risk with correct styling', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      const banner = screen.getByTestId('risk-banner');
      expect(banner).toHaveAttribute('data-risk-level', 'LOW');
      expect(screen.getByTestId('risk-title')).toHaveTextContent('Low Risk');
      expect(screen.getByTestId('risk-recommendation')).toBeInTheDocument();
    });

    it('displays HIGH risk with correct styling', () => {
      render(<ResultsDisplay results={mockHighRiskData} />);
      
      const banner = screen.getByTestId('risk-banner');
      expect(banner).toHaveAttribute('data-risk-level', 'HIGH');
      expect(screen.getByTestId('risk-title')).toHaveTextContent('High Risk');
    });

    it('displays backend-provided recommendation when present', () => {
      render(
        <ResultsDisplay
          results={{
            ...mockHighRiskData,
            recommendation: 'High similarity detected. Coordinate with Dr. Ibrahim before proceeding.'
          }}
        />
      );

      expect(screen.getByTestId('risk-recommendation')).toHaveTextContent(
        'High similarity detected. Coordinate with Dr. Ibrahim before proceeding.'
      );
    });

    it('shows maximum similarity score in banner', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('max-similarity')).toHaveTextContent('0.450');
    });
  });

  describe('User-Friendly Tier Names', () => {
    it('displays "Similar Past Projects" for tier1', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('tier-title-tier1')).toHaveTextContent('Similar Past Projects');
    });

    it('displays tier1 section when matches exist', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('tier-section-tier1')).toBeInTheDocument();
    });

    it('displays "Current Session Projects" for tier2', () => {
      render(<ResultsDisplay results={mockHighRiskData} />);
      
      expect(screen.getByTestId('tier-title-tier2')).toHaveTextContent('Current Session Projects');
    });

    it('does not display tier2 when no matches', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.queryByTestId('tier-section-tier2')).not.toBeInTheDocument();
    });
  });

  describe('Topic Match Display', () => {
    it('displays topic title prominently', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('topic-title-0')).toHaveTextContent('Machine Learning in Healthcare');
    });

    it('shows user-friendly similarity level instead of raw scores', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      // Should show "Low Match" or similar for 45% score
      const titleText = screen.getAllByText(/Match/i).some(el => 
        el.textContent.includes('Match')
      );
      expect(titleText).toBe(true);
    });

    it('displays metadata (supervisor, year)', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('supervisor-0')).toHaveTextContent('Dr. Smith');
      expect(screen.getByTestId('session-0')).toHaveTextContent('2023/2024');
    });

    it('shows "Show Technical Details" button by default', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      const detailBtn = screen.getByTestId('expand-details-0');
      expect(detailBtn).toHaveTextContent('Show Technical Details');
    });
  });

  describe('Expandable Algorithm Scores', () => {
    it('hides algorithm scores by default', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      // Algorithm details should not be visible
      expect(screen.queryByTestId('algorithm-details-0')).not.toBeInTheDocument();
    });

    it('shows algorithm scores when expanded', async () => {
      const user = userEvent.setup();
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      const expandBtn = screen.getByTestId('expand-details-0');
      await user.click(expandBtn);
      
      // Algorithm details should now be visible
      expect(screen.getByTestId('algorithm-details-0')).toBeInTheDocument();
      expect(screen.getByTestId('semantic-badge-0')).toBeInTheDocument();
    });

    it('toggles between Show and Hide text', async () => {
      const user = userEvent.setup();
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      const expandBtn = screen.getByTestId('expand-details-0');
      expect(expandBtn).toHaveTextContent('Show Technical Details');
      
      await user.click(expandBtn);
      expect(expandBtn).toHaveTextContent('Hide Technical Details');
      
      await user.click(expandBtn);
      expect(expandBtn).toHaveTextContent('Show Technical Details');
    });

    it('displays the semantic score without legacy algorithm badges', async () => {
      const user = userEvent.setup();
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      await user.click(screen.getByTestId('expand-details-0'));
      
      expect(screen.getByTestId('semantic-badge-0')).toHaveTextContent('Semantic:');
      expect(screen.queryByText(/jaccard|tf-idf|sbert/i)).not.toBeInTheDocument();
    });
  });

  describe('Summary Cards', () => {
    it('displays risk level in summary', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('summary-risk')).toHaveTextContent('LOW');
    });

    it('displays max similarity in summary', () => {
      render(<ResultsDisplay results={mockLowRiskData} />);
      
      expect(screen.getByTestId('summary-max-similarity')).toHaveTextContent('0.450');
    });

    it('displays total matches count', () => {
      render(<ResultsDisplay results={mockHighRiskData} />);
      
      const totalMatches = 2 + 1; // tier1: 2, tier2: 1
      expect(screen.getByTestId('summary-total-matches')).toHaveTextContent(totalMatches.toString());
    });
  });

  describe('Semantic score terminology', () => {
    it('labels checker summary as semantic similarity, not combined similarity', () => {
      render(<ResultsDisplay appearance="student-checker" results={{ ...mockLowRiskData, semantic_available: true }} />);
      expect(screen.getByText(/highest semantic similarity/i)).toBeInTheDocument();
      expect(screen.queryByText(/combined similarity/i)).not.toBeInTheDocument();
    });
  });

  describe('No Matches State', () => {
    it('shows friendly message when no matches found', () => {
      const noMatchesData = {
        risk_level: 'LOW',
        max_similarity: 0,
        semantic_available: true,
        tier1_matches: [],
        tier2_matches: [],
        tier3_matches: []
      };
      
      render(<ResultsDisplay results={noMatchesData} />);
      
      expect(screen.getByTestId('no-matches')).toBeInTheDocument();
      expect(screen.getByText(/No similar topics found/i)).toBeInTheDocument();
    });
  });

  describe('Multiple Matches in Different Tiers', () => {
    it('uses truthful under-review metadata labels for the student checker', () => {
      render(<ResultsDisplay appearance="student-checker" results={{
        ...mockLowRiskData,
        tier1_matches: [],
        tier3_matches: [{
          id: 8,
          topic_title: 'Under-review public health topic',
          supervisor_name: 'Dr. Reviewing Lecturer',
          session_year: '2026-08-05',
          semantic_score: 0.64
        }]
      }} />);

      const tier = screen.getByTestId('tier-section-tier3');
      expect(tier).toHaveTextContent('Reviewing lecturer: Dr. Reviewing Lecturer');
      expect(tier).toHaveTextContent('Review started: 2026-08-05');
      expect(tier).not.toHaveTextContent('Supervisor:');
      expect(tier).not.toHaveTextContent('Year:');
    });

    it('displays all tier sections with matches', () => {
      render(<ResultsDisplay results={mockHighRiskData} />);
      
      expect(screen.getByTestId('tier-section-tier1')).toBeInTheDocument();
      expect(screen.getByTestId('tier-section-tier2')).toBeInTheDocument();
      // tier3 is empty, should not render
      expect(screen.queryByTestId('tier-section-tier3')).not.toBeInTheDocument();
    });

    it('renders correct number of matches per tier', () => {
      render(<ResultsDisplay results={mockHighRiskData} />);
      
      // Tier 1 has 2 matches
      const tier1Matches = screen.getAllByTestId(/^topic-match-/);
      expect(tier1Matches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
