import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

// ============ Constants ============
const MIN_WORDS = 7;
const MAX_WORDS = 24;
const MIN_CHARS_GUIDELINE = 50;
const MAX_CHARS_GUIDELINE = 180;
const MAX_KEYWORDS_LENGTH = 500;

const RESEARCH_CATEGORIES = [
  '',
  'Epidemiology',
  'Infectious Diseases',
  'Biostatistics',
  'Health Policy',
  'Maternal & Child Health',
  'Environmental Health',
];

/**
 * Sanitize user input by removing dangerous characters and limiting length
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
const sanitizeInput = (text) => {
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets (XSS prevention)
    .slice(0, 1000);      // Max length safety
};

/**
 * TopicForm Component
 * 
 * A form component for topic input with real-time validation.
 * Validates word count (7-24 words) and character count (50-180 chars guideline).
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Callback function when form is submitted
 * @param {boolean} props.isLoading - Loading state during API call
 */
const TopicForm = ({ onSubmit, isLoading = false, appearance = 'default', compact = false, topicInputRef }) => {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const isCheckerShell = ['student-checker', 'lecturer-checker'].includes(appearance);
  const isLecturerChecker = appearance === 'lecturer-checker';

  /**
   * Count words in a string
   * @param {string} text - Text to count words from
   * @returns {number} Word count
   */
  const countWords = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, []);

  /**
   * Get validation status for the topic
   * @returns {Object} Validation status object
   */
  const getValidationStatus = useCallback(() => {
    const wordCount = countWords(topic);
    const charCount = topic.length;

    const isWordCountValid = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
    const isCharCountInGuideline = charCount >= MIN_CHARS_GUIDELINE && charCount <= MAX_CHARS_GUIDELINE;

    let borderColor = 'border-gray-300';
    let message = '';

    if (topic.trim()) {
      if (wordCount < MIN_WORDS) {
        borderColor = 'border-red-500';
        message = `Too short: ${wordCount} word${wordCount !== 1 ? 's' : ''} (minimum ${MIN_WORDS})`;
      } else if (wordCount > MAX_WORDS) {
        borderColor = 'border-red-500';
        message = `Too long: ${wordCount} words (maximum ${MAX_WORDS})`;
      } else {
        borderColor = 'border-green-500';
        message = 'Valid topic length';
      }
    }

    return {
      wordCount,
      charCount,
      isValid: isWordCountValid,
      isCharCountInGuideline,
      borderColor,
      message
    };
  }, [topic, countWords]);

  /**
   * Handle topic input change
   * @param {Event} e - Input change event
   */
  const handleTopicChange = (e) => {
    setTopic(e.target.value);
    setSubmissionError('');
  };

  /**
   * Handle keywords input change
   * @param {Event} e - Input change event
   */
  const handleKeywordsChange = (e) => {
    setKeywords(e.target.value);
    setSubmissionError('');
  };

  /**
   * Handle category change
   * @param {Event} e - Select change event
   */
  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setSubmissionError('');
  };

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validation = getValidationStatus();
    
    if (!validation.isValid) {
      return;
    }
    
    // Validate keywords length
    if (keywords && keywords.trim().length > MAX_KEYWORDS_LENGTH) {
      return;
    }

    try {
      const submissionSucceeded = await onSubmit({
        topic: sanitizeInput(topic),
        keywords: sanitizeInput(keywords),
        category: sanitizeInput(category)
      });
      
      if (submissionSucceeded !== false) {
        setTopic('');
        setKeywords('');
        setCategory('');
        setSubmissionError('');
      }
    } catch (err) {
      setSubmissionError(err.message || 'An error occurred while checking similarity');
    }
  };

  const validation = getValidationStatus();
  const isTopicInvalid = Boolean(topic.trim()) && !validation.isValid;
  const isKeywordsInvalid = keywords.trim().length > MAX_KEYWORDS_LENGTH;
  const topicDescribedBy = [
    'topic-guidance',
    'topic-count',
    isTopicInvalid ? 'topic-validation' : null
  ].filter(Boolean).join(' ');

  return (
    <div className={isCheckerShell
      ? 'w-full bg-white'
      : 'w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md'
    }>
      {isCheckerShell && !isLecturerChecker ? (
        <div className={compact ? 'mb-2' : 'mb-5'}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1B5E20]">
            Check your research topic
          </p>
          <h2 className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'} font-serif font-semibold text-[#1B5E20]`}>
            Similarity pre-check
          </h2>
        </div>
      ) : !isCheckerShell ? (
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Check Topic Similarity
        </h2>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className={compact ? 'space-y-2' : isCheckerShell ? 'space-y-5' : 'space-y-6'}>
        {/* Topic Input */}
        <div>
          <label 
            htmlFor="topic" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Research Topic <span className="text-red-500">*</span>
          </label>
          
          <textarea
            ref={topicInputRef}
            id="topic"
            value={topic}
            onChange={handleTopicChange}
            disabled={isLoading}
            aria-invalid={isTopicInvalid ? 'true' : undefined}
            aria-describedby={topicDescribedBy}
            placeholder="Enter your research topic (7-24 words)..."
            rows={compact ? 2 : isCheckerShell ? 5 : 4}
            className={`
              w-full px-4 py-3 rounded-lg border-2 
              ${validation.borderColor}
              focus:outline-none focus:ring-2 ${isTopicInvalid ? 'focus:border-red-500 focus:ring-red-500' : isCheckerShell ? 'focus:border-transparent focus:ring-[#1B5E20]' : 'focus:border-transparent focus:ring-blue-500'}
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
              resize-none
            `}
          />

          {/* Validation Feedback */}
          <div className="mt-2 space-y-1">
            {/* Word Count */}
            <div className="flex items-center justify-between text-sm">
              <span id="topic-validation" className={`
                font-medium
                ${topic.trim() && (validation.wordCount < MIN_WORDS || validation.wordCount > MAX_WORDS)
                  ? 'text-red-600' 
                  : validation.wordCount > 0 
                    ? 'text-green-600' 
                    : 'text-gray-500'
                }
              `}>
                {validation.message || 'Enter your topic to see validation'}
              </span>
              <span
                id="topic-count"
                data-testid="word-count"
                className={`
                ${topic.trim() && (validation.wordCount < MIN_WORDS || validation.wordCount > MAX_WORDS)
                  ? 'text-red-600'
                  : validation.wordCount > 0
                    ? 'text-green-600'
                    : 'text-gray-500'
                }
              `}>
                {validation.wordCount} / {MIN_WORDS}-{MAX_WORDS} words
              </span>
            </div>

            {/* Character Count */}
            <div id="topic-guidance" className={`${compact ? 'hidden' : 'flex'} items-center justify-between text-sm`}>
              <span className={`
                ${!validation.isCharCountInGuideline && validation.charCount > 0
                  ? 'text-yellow-600' 
                  : 'text-gray-500'
                }
              `}>
                {!validation.isCharCountInGuideline && validation.charCount > 0
                  ? 'Character count outside guideline (50-180 chars recommended)'
                  : 'Character count guideline: 50-180 chars'
                }
              </span>
              <span className={`
                ${!validation.isCharCountInGuideline && validation.charCount > 0
                  ? 'text-yellow-600' 
                  : 'text-gray-500'
                }
              `}>
                {validation.charCount} chars
              </span>
            </div>
          </div>
        </div>

        {/* Research Area / Category (Optional) */}
        <div>
          <label 
            htmlFor="category" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Research Area <span className="whitespace-nowrap text-gray-400">(Optional)</span>
          </label>

          <select
            id="category"
            value={category}
            onChange={handleCategoryChange}
            disabled={isLoading}
            className={`
              w-full px-4 py-3 rounded-lg border-2 border-gray-300 bg-white
              focus:outline-none focus:ring-2 ${isCheckerShell ? 'focus:ring-[#1B5E20]' : 'focus:ring-blue-500'} focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
            `}
          >
            {RESEARCH_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === '' ? 'Not specified' : cat}
              </option>
            ))}
          </select>

          <p className={`${compact ? 'hidden' : 'block'} mt-1 whitespace-normal break-keep text-left text-sm tracking-normal text-gray-500 hyphens-none [word-spacing:normal]`}>
            Select a category to refine results (optional)
          </p>
        </div>

        {/* Keywords Input (Optional) */}
        <div>
          <label 
            htmlFor="keywords" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Keywords <span className="whitespace-nowrap text-gray-400">(Optional)</span>
          </label>
          
          <input
            id="keywords"
            type="text"
            value={keywords}
            onChange={handleKeywordsChange}
            disabled={isLoading}
            aria-invalid={isKeywordsInvalid ? 'true' : undefined}
            aria-describedby={`keyword-guidance${isKeywordsInvalid ? ' keyword-validation' : ''}`}
            placeholder="e.g., machine learning, neural networks, AI"
            className={`
              w-full px-4 py-3 rounded-lg border-2 ${isKeywordsInvalid ? 'border-red-500' : 'border-gray-300'}
              focus:outline-none focus:ring-2 ${isKeywordsInvalid ? 'focus:border-red-500 focus:ring-red-500' : isCheckerShell ? 'focus:border-transparent focus:ring-[#1B5E20]' : 'focus:border-transparent focus:ring-blue-500'}
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
            `}
          />
          
          <p id="keyword-guidance" className={`${compact ? 'hidden' : 'block'} mt-1 whitespace-normal break-keep text-left text-sm tracking-normal text-gray-500 hyphens-none [word-spacing:normal]`}>
            Add relevant keywords to improve similarity detection
          </p>
          {isKeywordsInvalid && <p id="keyword-validation" className="mt-1 text-sm font-medium text-red-600">Keywords must be 500 characters or fewer.</p>}
        </div>

        {/* Error Message */}
        {submissionError && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <div className="flex items-center">
              <svg 
                className="w-5 h-5 text-red-500 mr-2" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                  clipRule="evenodd" 
                />
              </svg>
              <p className="text-sm text-red-700 font-medium">{submissionError}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!(isLoading && appearance === 'student-checker') && <button
          type="submit"
          disabled={!validation.isValid || isLoading}
          className={`flex
            w-full py-3 px-6 rounded-lg font-medium text-white
            transition-all duration-200
            ${!validation.isValid || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : isCheckerShell
                ? 'bg-[#1B5E20] hover:bg-[#174F1C] active:bg-[#123F16] shadow-sm hover:shadow-md'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg'
            }
            disabled:opacity-50
            items-center justify-center
          `}
        >
          {isLoading ? (
            <>
              <svg 
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking Similarity...
            </>
          ) : (
            'Check Similarity'
          )}
        </button>}

        {/* Help Text */}
        {isCheckerShell ? (!compact && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-text-secondary">
            <p className="font-semibold text-[#1B5E20]">Validation benchmark</p>
            <p className="whitespace-normal break-keep text-left tracking-normal hyphens-none [word-spacing:normal]">
              {isLecturerChecker
                ? 'Use 7-24 clear words. Category and keywords are optional and only affect this advisory check.'
                : 'Use 7-24 clear words. Category and keywords are optional, but they can improve matching.'}
            </p>
          </div>
        )) : (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              💡 Tips for Best Results:
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Use 7-24 words for your topic title</li>
              <li>Be specific and descriptive</li>
              <li>Include key technical terms</li>
              <li>Add relevant keywords for better matching</li>
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

TopicForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  appearance: PropTypes.oneOf(['default', 'student-checker', 'lecturer-checker']),
  compact: PropTypes.bool,
  topicInputRef: PropTypes.shape({ current: PropTypes.object })
};

export default TopicForm;
