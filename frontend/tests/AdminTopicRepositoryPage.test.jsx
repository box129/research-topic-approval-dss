import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminTopicRepositoryPage from '../src/pages/admin/TopicRepositoryPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import {
  commitAdminTopicImport,
  getAdminTopicsSummary,
  listAdminTopics,
  previewAdminTopicImport
} from '../src/api/admin';

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
  listAdminTopics: vi.fn(),
  previewAdminTopicImport: vi.fn(),
  commitAdminTopicImport: vi.fn()
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

const previewResponse = {
  data: {
    mode: 'preview',
    metadata: {
      sheet_name: 'Sheet1',
      total_parsed_rows: 5
    },
    records: [
      { title: 'Malaria prevention in rural communities', lifecycle_bucket: 'historical' },
      { title: 'Hand hygiene compliance in hospitals', lifecycle_bucket: 'under_review' },
      { title: 'Maternal health education among teenagers', lifecycle_bucket: 'current_session' }
    ],
    import_report: {
      total_rows: 5,
      accepted_rows: 3,
      skipped_rows: 2,
      missing_title_rows: 1,
      incomplete_context_rows: 2,
      duplicate_title_rows: 1
    }
  },
  status: 'success'
};

const commitResponse = {
  data: {
    mode: 'commit',
    metadata: {
      sheet_name: 'Sheet1',
      total_parsed_rows: 5
    },
    import_report: previewResponse.data.import_report,
    persistence_report: {
      attempted_records: 3,
      inserted_records: 2,
      skipped_records: 0,
      failed_records: 1,
      inserted_by_bucket: {
        historical: 1,
        current_session: 1,
        under_review: 0
      },
      warnings: [],
      errors: [
        {
          title: 'Hand hygiene compliance in hospitals',
          lifecycle_bucket: 'under_review',
          message: 'Example backend persistence error'
        }
      ]
    }
  },
  status: 'success'
};

function makeXlsxFile(name = 'topics.xlsx') {
  return new File(['fake spreadsheet bytes'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function selectImportFile(file = makeXlsxFile()) {
  fireEvent.change(screen.getByTestId('topic-import-file-input'), {
    target: {
      files: [file]
    }
  });
  return file;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('AdminTopicRepositoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAdminTopicsSummary.mockResolvedValue(summaryResponse);
    listAdminTopics.mockResolvedValue(listResponse);
    previewAdminTopicImport.mockResolvedValue(previewResponse);
    commitAdminTopicImport.mockResolvedValue(commitResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders connected read-only repository summary and real topic rows', async () => {
    render(<AdminTopicRepositoryPage />);

    expect(screen.getByRole('heading', { name: /topic repository/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only topic repository view with an admin-audited .xlsx import preview/i)).toBeInTheDocument();

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

  it('allows selecting an xlsx file for the real admin import workflow', async () => {
    render(<AdminTopicRepositoryPage />);

    const file = selectImportFile();

    await waitFor(() => {
      expect(screen.getByText(`Selected file: ${file.name}`)).toBeInTheDocument();
    });
    expect(screen.getByText(/admin-only and audited by the backend/i)).toBeInTheDocument();
  });

  it('shows preview loading state and calls the real preview helper with the selected file', async () => {
    const deferred = createDeferred();
    previewAdminTopicImport.mockReturnValue(deferred.promise);

    render(<AdminTopicRepositoryPage />);
    const file = selectImportFile();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previewing/i })).toBeDisabled();
    });
    expect(previewAdminTopicImport).toHaveBeenCalledWith(file);

    await act(async () => {
      deferred.resolve(previewResponse);
      await deferred.promise;
    });
  });

  it('renders preview success with real mocked backend report values', async () => {
    render(<AdminTopicRepositoryPage />);
    selectImportFile();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Preview complete/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Preview parsed 3 accepted normalized records/i)).toBeInTheDocument();
    expect(screen.getByText(/Preview import report/i)).toBeInTheDocument();
    expect(screen.getByText(/Total rows/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/Accepted rows/i)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate in batch/i)).toBeInTheDocument();
  });

  it('shows preview errors without fake reports', async () => {
    previewAdminTopicImport.mockRejectedValue({
      response: {
        data: {
          message: 'Only .xlsx import files are supported.'
        }
      }
    });

    render(<AdminTopicRepositoryPage />);
    selectImportFile(makeXlsxFile('topics.csv'));
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Import preview failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Only .xlsx import files are supported/i)).toBeInTheDocument();
    expect(screen.getByText(/No fallback import report or fake preview rows are displayed/i)).toBeInTheDocument();
  });

  it('keeps commit disabled before successful preview', async () => {
    render(<AdminTopicRepositoryPage />);

    expect(screen.getByRole('button', { name: /commit import/i })).toBeDisabled();

    selectImportFile();

    expect(screen.getByRole('button', { name: /commit import/i })).toBeDisabled();
    expect(commitAdminTopicImport).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(listAdminTopics).toHaveBeenCalledTimes(1);
    });
  });

  it('shows commit loading after successful preview', async () => {
    const deferred = createDeferred();
    commitAdminTopicImport.mockReturnValue(deferred.promise);

    render(<AdminTopicRepositoryPage />);
    const file = selectImportFile();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));
    await waitFor(() => {
      expect(screen.getByText(/Preview complete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /commit import/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /committing/i })).toBeDisabled();
    });
    expect(commitAdminTopicImport).toHaveBeenCalledWith(file);

    await act(async () => {
      deferred.resolve(commitResponse);
      await deferred.promise;
    });
  });

  it('renders commit success with real mocked persistence values', async () => {
    render(<AdminTopicRepositoryPage />);
    selectImportFile();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));
    await waitFor(() => {
      expect(screen.getByText(/Preview complete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /commit import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Commit complete/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Commit persistence report/i)).toBeInTheDocument();
    expect(screen.getByText(/Attempted records/i)).toBeInTheDocument();
    expect(screen.getByText(/Inserted records/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed records/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical inserted/i)).toBeInTheDocument();
    expect(screen.getByText(/Current session inserted/i)).toBeInTheDocument();
  });

  it('shows commit errors without fake persistence results', async () => {
    commitAdminTopicImport.mockRejectedValue({
      response: {
        data: {
          message: 'Commit failed.'
        }
      }
    });

    render(<AdminTopicRepositoryPage />);
    selectImportFile();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));
    await waitFor(() => {
      expect(screen.getByText(/Preview complete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /commit import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Import commit failed/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/^Commit failed\. No fallback persistence report or fake commit result is displayed\.$/i)
    ).toBeInTheDocument();
  });

  it('clearly leaves duplicate-existing and richer row-level reports deferred', async () => {
    render(<AdminTopicRepositoryPage />);

    expect(screen.getAllByText(/duplicate-existing checks/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/row-level operator reports/i)).toBeInTheDocument();
    expect(screen.getAllByText(/embedding generation/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/duplicate existing rows: 0/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/row 12/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(listAdminTopics).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call unrelated mutation clients or expose unsupported operational actions', async () => {
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
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/fake import row/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sample import result/i)).not.toBeInTheDocument();
  });
});
