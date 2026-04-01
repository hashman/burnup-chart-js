import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../auth/LoginPage';

// Mock useAuth
const mockLogin = vi.fn();
const mockBootstrap = vi.fn();
let mockInitialized = true;

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    bootstrap: mockBootstrap,
    initialized: mockInitialized,
  }),
}));

beforeEach(() => {
  mockLogin.mockReset();
  mockBootstrap.mockReset();
  mockInitialized = true;
});

describe('LoginPage', () => {
  describe('login mode (initialized = true)', () => {
    it('renders login form with title and button', () => {
      render(<LoginPage />);

      expect(screen.getByText('燃盡圖')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
    });

    it('renders logo image', () => {
      render(<LoginPage />);
      expect(screen.getByAltText('Burnup Chart')).toBeInTheDocument();
    });

    it('calls login on form submit', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);

      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'admin');
      await user.type(document.querySelector('input[type="password"]'), 'password123');
      await user.click(screen.getByRole('button', { name: '登入' }));

      expect(mockLogin).toHaveBeenCalledWith('admin', 'password123');
    });

    it('shows error on login failure', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('帳號或密碼錯誤'));

      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'admin');
      await user.type(document.querySelector('input[type="password"]'), 'wrong');
      await user.click(screen.getByRole('button', { name: '登入' }));

      expect(await screen.findByText('帳號或密碼錯誤')).toBeInTheDocument();
    });

    it('shows parsed JSON error detail', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('{"detail":"自訂錯誤訊息"}'));

      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'admin');
      await user.type(document.querySelector('input[type="password"]'), 'wrong');
      await user.click(screen.getByRole('button', { name: '登入' }));

      expect(await screen.findByText('自訂錯誤訊息')).toBeInTheDocument();
    });
  });

  describe('bootstrap mode (initialized = false)', () => {
    beforeEach(() => {
      mockInitialized = false;
    });

    it('renders bootstrap form', () => {
      render(<LoginPage />);

      expect(screen.getByText('建立管理員帳號')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '建立帳號並登入' })).toBeInTheDocument();
      expect(screen.getByText('密碼至少 8 個字元')).toBeInTheDocument();
      expect(screen.getByText(/第一次使用/)).toBeInTheDocument();
    });

    it('validates short username', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'ab');
      await user.type(document.querySelector('input[type="password"]'), 'password123');
      await user.click(screen.getByRole('button', { name: '建立帳號並登入' }));

      expect(await screen.findByText('帳號至少需要 3 個字元')).toBeInTheDocument();
      expect(mockBootstrap).not.toHaveBeenCalled();
    });

    it('validates short password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'admin');
      await user.type(document.querySelector('input[type="password"]'), 'short');
      await user.click(screen.getByRole('button', { name: '建立帳號並登入' }));

      expect(await screen.findByText('密碼至少需要 8 個字元')).toBeInTheDocument();
      expect(mockBootstrap).not.toHaveBeenCalled();
    });

    it('calls bootstrap with valid input', async () => {
      const user = userEvent.setup();
      mockBootstrap.mockResolvedValue(undefined);

      render(<LoginPage />);

      await user.type(screen.getByRole('textbox'), 'admin');
      await user.type(document.querySelector('input[type="password"]'), 'password123');
      await user.click(screen.getByRole('button', { name: '建立帳號並登入' }));

      expect(mockBootstrap).toHaveBeenCalledWith('admin', 'password123');
    });
  });
});
