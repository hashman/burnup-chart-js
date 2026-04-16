import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogPanel from '../audit/AuditLogPanel';

const mockRequestJson = vi.fn();
vi.mock('../api', () => ({
  requestJson: (...args) => mockRequestJson(...args),
}));

const sampleUsers = [{ id: 'user_1', displayName: 'Admin', username: 'admin' }];

const sampleLogs = {
  items: [
    {
      id: 'audit_1',
      userId: 'user_1',
      userDisplay: 'admin',
      action: 'create',
      entityType: 'project',
      entityId: 'proj_1',
      entityLabel: 'Test Project',
      changes: { name: { new: 'Test Project' } },
      createdAt: '2026-04-01T10:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

const emptyLogs = { items: [], total: 0, page: 1, pageSize: 20 };

function mockApiResponses({ users = sampleUsers, logs = sampleLogs } = {}) {
  mockRequestJson.mockImplementation((url) => {
    if (url.includes('users')) return Promise.resolve(users);
    if (url.includes('audit-logs')) return Promise.resolve(logs);
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  mockRequestJson.mockReset();
});

describe('AuditLogPanel', () => {
  it('renders panel title and close button', async () => {
    mockApiResponses({ logs: emptyLogs });
    const onClose = vi.fn();
    render(<AuditLogPanel onClose={onClose} />);

    expect(screen.getByText('稽核記錄')).toBeInTheDocument();

    const user = userEvent.setup();
    // The close button contains an X icon from lucide-react
    const closeButton = screen.getByText('稽核記錄').closest('div').querySelector('button');
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state initially', () => {
    mockRequestJson.mockImplementation(() => new Promise(() => {}));
    render(<AuditLogPanel onClose={vi.fn()} />);

    expect(screen.getByText('載入中...')).toBeInTheDocument();
  });

  it('shows empty state when no logs', async () => {
    mockApiResponses({ users: [], logs: emptyLogs });
    render(<AuditLogPanel onClose={vi.fn()} />);

    expect(await screen.findByText('沒有稽核記錄')).toBeInTheDocument();
  });

  it('renders audit log entries', async () => {
    mockApiResponses();
    render(<AuditLogPanel onClose={vi.fn()} />);

    expect(await screen.findByText('admin')).toBeInTheDocument();
    // "建立" appears in both the filter dropdown option and the table cell
    const allCreate = screen.getAllByText('建立');
    expect(allCreate.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    // "專案" also appears in filter dropdown; verify at least one is in the table
    const allProject = screen.getAllByText('專案');
    expect(allProject.length).toBeGreaterThanOrEqual(2);
  });

  it('expands changes on row click', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    render(<AuditLogPanel onClose={vi.fn()} />);

    // Wait for the row to appear
    const adminCell = await screen.findByText('admin');
    const row = adminCell.closest('tr');
    await user.click(row);

    // The expanded section should show the change field and value
    expect(await screen.findByText('name:')).toBeInTheDocument();
    // "Test Project" appears both in the row and in the expanded changes
    const testProjectElements = screen.getAllByText('Test Project');
    expect(testProjectElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows filter dropdowns', async () => {
    mockApiResponses({ logs: emptyLogs });
    render(<AuditLogPanel onClose={vi.fn()} />);

    // These labels appear as both filter labels and table headers, so use getAllByText
    expect(screen.getAllByText('使用者').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('實體類型').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('操作').length).toBeGreaterThanOrEqual(1);
  });

  it('shows pagination info', async () => {
    mockApiResponses({
      logs: {
        items: sampleLogs.items,
        total: 25,
        page: 1,
        pageSize: 20,
      },
    });
    render(<AuditLogPanel onClose={vi.fn()} />);

    expect(await screen.findByText(/共 25 筆記錄/)).toBeInTheDocument();
  });
});
