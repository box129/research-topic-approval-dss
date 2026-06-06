import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminTopicRepositoryPage from '../src/pages/admin/TopicRepositoryPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { getAdminTopicsSummary, listAdminTopics } from '../src/api/admin';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../src/api/admin', () => ({
  getAdminTopicsSummary: vi.fn(),
  listAdminTopics: vi.fn()
}));

const summaryResponse = {
  data: {
    totals: {
      all: 3,
      historical: 1,
      currentSession: 1,
      underReview: 1
    },
    byCategory: [
      { category: 'Public Health', count: 2 },
      { category: null, count: 1 }
    ],
    bySessionYear: [
      { sessionYear: '2025/2026', count: 2 }
    ],
    dataQuality: {
      missingCategory: 1,
      missingSessionYear: 0,
      missingSupervisorName: 0,
      missingContextFields: 1,
      withEmbeddings: 1,
      withoutEmbeddings: 2,
      withImportWarnings: 1
    }
  },
  meta: {
    generatedAt: '2026-06-06T10:05:14.000Z',
    dataCoverage: 'Read-only aggregate counts from existing topic tables.'
  }
};

const listResponse = {
  data: {
    items: [
      {
        id: 1,
        lifecycle: 'historical',
        title: 'Malaria prevention in rural communities',
        keywords: 'malaria, prevention',
        category: 'Public Health',
        sessionYear: '2023/2024',
        supervisorName: 'Dr. Adeyemi',
        sourceType: 'spreadsheet',
        dataQuality: {
          hasEmbedding: true,
          hasContextFields: true,
          hasImportWarnings: false,
          importWarningCount: 0
        }
      },
      {
        id: 2,
        lifecycle: 'under-review',
        title: 'Hand hygiene compliance in hospitals',
        keywords: 'hygiene, compliance',
        category: null,
        sessionYear: null,
        supervisorName: null,
        sourceType: 'manual',
        dataQuality: {
          hasEmbedding: false,
          hasContextFields: false,
          hasImportWarnings: true,
          importWarningCount: 1
        }
      }
    ]
  },
  meta: {
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    filters: {
      lifecycle: 'all',
      sort: 'updatedAt',
      direction: 'desc'
    },
    dataCoverage: 'Read-only topic data from existing lifecycle tables.'
  }
};

describe('AdminTopicRepositoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAdminTopicsSummary.mockResolvedValue(summaryResponse);
    listAdminTopics.mockResolvedValue(listResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders connected read-only repository summary and real topic rows', async () => {
    render(<AdminTopicRepositoryPage />);

    expect(screen.getByRole('heading', { name: /topic repository/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only topic repository view connected to existing lifecycle tables/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getAdminTopicsSummary).toHaveBeenCalledTimes(1);
      expect(listAdminTopics).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/read-only repository data/i)).toBeInTheDocument();
    expect(screen.getByText(/Malaria prevention in rural communities/i)).toBeInTheDocument();
    expect(screen.getByText(/Hand hygiene compliance in hospitals/i)).toBeInTheDocument();
    expect(screen.getByText(/Public Health: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing category: 1/i)).toBeInTheDocument();
  });

  it('keeps missing fields and unavailable embeddings honest', async () => {
    render(<AdminTopicRepositoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Hand hygiene compliance in hospitals/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Context incomplete/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Import warnings/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Embedding unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not recorded/i).length).toBeGreaterThanOrEqual(2);
  });

  it('calls the list endpoint with lifecycle and search filters', async () => {
    render(<AdminTopicRepositoryPage />);

    await waitFor(() => {
      expect(listAdminTopics).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText(/search title/i), {
      target: { name: 'search', value: 'malaria' }
    });
    fireEvent.change(screen.getByDisplayValue(/All lifecycle tables/i), {
      target: { name: 'lifecycle', value: 'historical' }
    });

    await waitFor(() => {
      expect(listAdminTopics).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        sort: 'updatedAt',
        direction: 'desc',
        lifecycle: 'historical',
        search: 'malaria'
      });
    });
  });

  it('shows an honest empty state when no topic records match', async () => {
    listAdminTopics.mockResolvedValue({
      data: { items: [] },
      meta: {
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }
    });

    render(<AdminTopicRepositoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No topic records returned/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No placeholder topics are shown/i)).toBeInTheDocument();
  });

  it('shows unavailable states when repository endpoints fail', async () => {
    getAdminTopicsSummary.mockRejectedValue(new Error('summary unavailable'));
    listAdminTopics.mockRejectedValue(new Error('list unavailable'));

    render(<AdminTopicRepositoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Repository summary unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Topic records unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No fallback topic rows are displayed/i)).toBeInTheDocument();
  });

  it('does not call mutation clients or expose enabled operational actions', async () => {
    render(<AdminTopicRepositoryPage />);

    await waitFor(() => {
      expect(listAdminTopics).toHaveBeenCalledTimes(1);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});
