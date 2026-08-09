import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminSystemSettingsPage from '../src/pages/admin/SystemSettingsPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { listAdminSettings } from '../src/api/admin';

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
  listAdminSettings: vi.fn()
}));

const settingsResponse = {
  data: {
    items: [
      {
        key: 'demo_auth_users_notice',
        value: 'Demo users are available for local authentication testing.',
        updatedAt: '2026-06-05T10:00:00.000Z',
        updatedBy: {
          id: 1,
          name: 'Admin User',
          email: 'admin@example.edu',
          role: 'admin'
        }
      }
    ]
  },
  meta: {
    generatedAt: '2026-06-06T10:05:14.000Z',
    dataCoverage: 'Read-only settings from SystemSetting table.',
    mutationStatus: 'Settings updates remain deferred until key-specific validation is approved.'
  }
};

describe('AdminSystemSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    listAdminSettings.mockResolvedValue(settingsResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders connected read-only system settings from real records', async () => {
    render(<AdminSystemSettingsPage />);

    expect(screen.getByRole('heading', { name: /system settings/i })).toBeInTheDocument();
    expect(screen.getByText(/Review the configuration values currently stored by the system/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminSettings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/demo_auth_users_notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo authentication users/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo users are available for local authentication testing/i)).toBeInTheDocument();
    expect(screen.getByText(/Updated by Admin User/i)).toBeInTheDocument();
  });

  it('keeps settings read-only and avoids mutation clients', async () => {
    render(<AdminSystemSettingsPage />);

    await waitFor(() => {
      expect(listAdminSettings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Configuration values can be reviewed here but cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save|update/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('shows an honest empty state when no settings are returned', async () => {
    listAdminSettings.mockResolvedValue({
      data: { items: [] },
      meta: {
        generatedAt: '2026-06-06T10:05:14.000Z',
        dataCoverage: 'Read-only settings from SystemSetting table.',
        mutationStatus: 'Settings updates remain deferred until key-specific validation is approved.'
      }
    });

    render(<AdminSystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No system settings/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No configuration values are available/i)).toBeInTheDocument();
  });

  it('shows unavailable state when the settings endpoint fails', async () => {
    listAdminSettings.mockRejectedValue(new Error('settings unavailable'));

    render(<AdminSystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/System settings unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/System settings could not be loaded/i)).toBeInTheDocument();
  });

  it('does not expose unsupported settings controls', async () => {
    render(<AdminSystemSettingsPage />);

    await waitFor(() => {
      expect(listAdminSettings).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/threshold/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/feature flag/i)).not.toBeInTheDocument();
  });
});
