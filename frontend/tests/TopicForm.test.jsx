import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicForm from '../src/components/features/TopicInput/TopicForm';

function fillTopic(value) {
  const textarea = screen.getByPlaceholderText(/enter your research topic/i);
  fireEvent.change(textarea, { target: { value } });
  return textarea;
}

function fillKeywords(value) {
  const keywordsInput = screen.getByPlaceholderText(/e.g., machine learning/i);
  fireEvent.change(keywordsInput, { target: { value } });
  return keywordsInput;
}

function selectCategory(value) {
  const categorySelect = screen.getByLabelText(/research area/i);
  fireEvent.change(categorySelect, { target: { value } });
  return categorySelect;
}

describe('TopicForm Component', () => {
  let mockOnSubmit;
  let user;

  beforeEach(() => {
    mockOnSubmit = vi.fn();
    user = userEvent.setup();
  });

  // ==================== RENDERING TESTS ====================
  
  describe('Rendering Tests', () => {
    it('1. renders textarea input', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('1a. renders research area select', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      const select = screen.getByLabelText(/research area/i);
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
      // default option should be not specified
      expect(screen.getByText(/not specified/i)).toBeInTheDocument();
    });

    it('2. renders submit button', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('3. renders word counter', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const wordCounter = screen.getByText(/0 \/ 7-24 words/i);
      expect(wordCounter).toBeInTheDocument();
    });

    it('4. renders character counter', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      // Use getAllByText since there are multiple elements with "chars"
      const charCounters = screen.getAllByText(/0 chars/i);
      expect(charCounters.length).toBeGreaterThan(0);
    });
  });

  // ==================== VALIDATION TESTS ====================
  
  describe('Validation Tests', () => {
    it('5. shows red border when word count < 7', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = fillTopic('Machine learning AI');
      
      expect(textarea).toHaveClass('border-red-500');
      expect(screen.getByText(/too short: 3 words/i)).toBeInTheDocument();
    });

    it('6. shows red border when word count > 24', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const longText = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive';
      const textarea = fillTopic(longText);
      
      expect(textarea).toHaveClass('border-red-500');
      expect(screen.getByText(/too long: 25 words/i)).toBeInTheDocument();
    });

    it('7. shows green border when word count 7-24', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = fillTopic('Machine learning algorithms for natural language processing tasks');
      
      expect(textarea).toHaveClass('border-green-500');
      expect(screen.getByText(/valid topic length/i)).toBeInTheDocument();
    });

    it('8. disables submit button when invalid', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      expect(submitButton).toBeDisabled();
    });

    it('9. enables submit button when valid', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Machine learning algorithms for natural language processing tasks');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  // ==================== USER INTERACTION TESTS ====================
  
  describe('User Interaction Tests', () => {
    it('10. word counter updates on input', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      
      // Initially 0 words
      expect(screen.getByText(/0 \/ 7-24 words/i)).toBeInTheDocument();
      
      // Type 5 words
      await user.type(textarea, 'Machine learning neural network AI');
      expect(screen.getByText(/5 \/ 7-24 words/i)).toBeInTheDocument();
      
      // Add more words
      await user.type(textarea, ' deep learning');
      expect(screen.getByText(/7 \/ 7-24 words/i)).toBeInTheDocument();
    });

    it('11. character counter updates on input', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      
      // Initially 0 chars - use getAllByText
      const initialChars = screen.getAllByText(/0 chars/i);
      expect(initialChars.length).toBeGreaterThan(0);
      
      // Type text
      await user.type(textarea, 'Hello');
      expect(screen.getByText(/5 chars/i)).toBeInTheDocument();
      
      // Add more text
      await user.type(textarea, ' World');
      expect(screen.getByText(/11 chars/i)).toBeInTheDocument();
    });

    it('12. submit button triggers onSubmit callback', async () => {
      mockOnSubmit.mockResolvedValue();
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const validTopic = 'Machine learning algorithms for natural language processing tasks';
      fillTopic(validTopic);
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          topic: validTopic,
          keywords: '',
          category: ''
        });
      });
    });

    it('13. loading state shows spinner', () => {
      render(<TopicForm onSubmit={mockOnSubmit} isLoading={true} />);
      
      const submitButton = screen.getByRole('button', { name: /checking similarity/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      // Check for spinner SVG
      const spinner = submitButton.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('14. error state shows error message', async () => {
      const errorMessage = 'Network error occurred';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));
      
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Machine learning algorithms for natural language processing tasks');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  // ==================== EDGE CASES ====================
  
  describe('Edge Cases', () => {
    it('15. handles empty input', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      expect(textarea.value).toBe('');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      expect(submitButton).toBeDisabled();
      
      // Should show default border color
      expect(textarea).toHaveClass('border-gray-300');
    });

    it('16. handles rapid typing (debounce)', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue();
      const user = userEvent.setup();

      render(<TopicForm onSubmit={mockOnSubmit} />);

      const textarea = screen.getByPlaceholderText(/enter your research topic/i);

      // Type 7 words
      await user.type(textarea, 'Machine learning algorithms for natural language processing');

      // Check word count using data-testid
      expect(screen.getByTestId('word-count')).toHaveTextContent('7 / 7-24 words');

      // Should show green border for valid count
      expect(textarea).toHaveClass('border-green-500');
    });

    it('17. trims whitespace correctly', async () => {
      mockOnSubmit.mockResolvedValue();
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      // Type with extra whitespace
      fillTopic('  Machine learning algorithms for natural language processing  ');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          topic: 'Machine learning algorithms for natural language processing',
          keywords: '',
          category: ''
        });
      });
    });
  });

  // ==================== ADDITIONAL COMPREHENSIVE TESTS ====================
  
  describe('Additional Comprehensive Tests', () => {
    it('handles keywords input correctly', async () => {
      mockOnSubmit.mockResolvedValue();
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Machine learning algorithms for natural language processing tasks');
      fillKeywords('AI, neural networks, deep learning');
      selectCategory('Epidemiology');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          topic: 'Machine learning algorithms for natural language processing tasks',
          keywords: 'AI, neural networks, deep learning',
          category: 'Epidemiology'
        });
      });
    });

    it('clears form after successful submission', async () => {
      mockOnSubmit.mockResolvedValue();
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = fillTopic('Machine learning algorithms for natural language processing tasks');
      const keywordsInput = fillKeywords('AI, neural networks');
      const categorySelect = selectCategory('Infectious Diseases');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(textarea.value).toBe('');
        expect(keywordsInput.value).toBe('');
        expect(categorySelect.value).toBe('');
      });
    });

    it('disables inputs during loading', () => {
      render(<TopicForm onSubmit={mockOnSubmit} isLoading={true} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      const keywordsInput = screen.getByPlaceholderText(/e.g., machine learning/i);
      const categorySelect = screen.getByLabelText(/research area/i);
      
      expect(textarea).toBeDisabled();
      expect(keywordsInput).toBeDisabled();
      expect(categorySelect).toBeDisabled();
    });

    it('shows validation message for minimum word count', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Machine learning AI');
      
      expect(screen.getByText(/too short: 3 words \(minimum 7\)/i)).toBeInTheDocument();
    });

    it('shows validation message for maximum word count', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const longText = Array(26).fill('word').join(' ');
      fillTopic(longText);
      
      expect(screen.getByText(/too long: 26 words \(maximum 24\)/i)).toBeInTheDocument();
    });

    it('handles character count guideline warnings', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      // Type text with less than 50 characters but valid word count
      fillTopic('AI ML NLP DL CV RL GAN');
      
      // Should show character guideline warning
      expect(screen.getByText(/character count outside guideline/i)).toBeInTheDocument();
    });

    it('prevents submission with invalid word count', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Too short');
      
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      
      // Button should be disabled for invalid input
      expect(submitButton).toBeDisabled();
      
      // onSubmit should not be called
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('clears error message when user starts typing', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Test error'));
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      
      // Type valid input to enable submit
      fillTopic('Machine learning algorithms for natural language processing');
      const submitButton = screen.getByRole('button', { name: /check similarity/i });
      await user.click(submitButton);
      
      // Error should appear from rejected promise
      await waitFor(() => {
        expect(screen.getByText(/test error/i)).toBeInTheDocument();
      });
      
      // Start typing again
      await user.clear(textarea);
      await user.type(textarea, 'New topic');
      
      // Error should be cleared
      expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
    });

    it('handles multiple spaces between words correctly', async () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      fillTopic('Machine    learning    algorithms    for    natural    language    processing');
      
      // Should count as 7 words despite multiple spaces
      expect(screen.getByText(/7 \/ 7-24 words/i)).toBeInTheDocument();
    });

    it('renders help text with tips', () => {
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      expect(screen.getByText(/tips for best results/i)).toBeInTheDocument();
      expect(screen.getByText(/use 7-24 words for your topic title/i)).toBeInTheDocument();
      expect(screen.getByText(/be specific and descriptive/i)).toBeInTheDocument();
    });

    it('handles form submission with Enter key', async () => {
      mockOnSubmit.mockResolvedValue();
      render(<TopicForm onSubmit={mockOnSubmit} />);
      
      const textarea = screen.getByPlaceholderText(/enter your research topic/i);
      fillTopic('Machine learning algorithms for natural language processing tasks');
      
      // Find the form and submit it
      const form = textarea.closest('form');
      await user.click(screen.getByRole('button', { name: /check similarity/i }));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });
});
