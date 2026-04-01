import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from '../auth/UserMenu';

const mockLogout = vi.fn();
let mockUser = null;

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

beforeEach(() => {
  mockLogout.mockReset();
  mockUser = {
    displayName: 'Test Admin',
    role: 'admin',
  };
});

describe('UserMenu', () => {
  it('renders nothing when user is null', () => {
    mockUser = null;
    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });

  it('renders user display name and role badge', () => {
    render(<UserMenu />);

    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('管理員')).toBeInTheDocument();
  });

  it('shows member role label', () => {
    mockUser = { displayName: 'Bob', role: 'member' };
    render(<UserMenu />);
    expect(screen.getByText('成員')).toBeInTheDocument();
  });

  it('shows viewer role label', () => {
    mockUser = { displayName: 'Eve', role: 'viewer' };
    render(<UserMenu />);
    expect(screen.getByText('檢視者')).toBeInTheDocument();
  });

  it('opens dropdown on click and shows logout', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByText('Test Admin'));
    expect(screen.getByText('登出')).toBeInTheDocument();
  });

  it('shows admin panel button for admin users', async () => {
    const user = userEvent.setup();
    const onAdminPanel = vi.fn();
    render(<UserMenu onAdminPanel={onAdminPanel} />);

    await user.click(screen.getByText('Test Admin'));
    expect(screen.getByText('使用者管理')).toBeInTheDocument();

    await user.click(screen.getByText('使用者管理'));
    expect(onAdminPanel).toHaveBeenCalled();
  });

  it('does not show admin panel button for non-admin', async () => {
    mockUser = { displayName: 'Bob', role: 'member' };
    const user = userEvent.setup();
    render(<UserMenu onAdminPanel={vi.fn()} />);

    await user.click(screen.getByText('Bob'));
    expect(screen.queryByText('使用者管理')).not.toBeInTheDocument();
  });

  it('calls logout when clicking logout button', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByText('Test Admin'));
    await user.click(screen.getByText('登出'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <UserMenu />
        <div data-testid="outside">outside</div>
      </div>,
    );

    await user.click(screen.getByText('Test Admin'));
    expect(screen.getByText('登出')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('登出')).not.toBeInTheDocument();
  });
});
