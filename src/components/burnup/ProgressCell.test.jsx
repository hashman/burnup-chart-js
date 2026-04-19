import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressCell } from './ProgressCell.jsx';

describe('ProgressCell', () => {
  test('renders the current value as percent', () => {
    render(<ProgressCell value={42} onCommit={() => {}} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  test('clicking the percent number switches to input mode', () => {
    render(<ProgressCell value={30} onCommit={() => {}} />);
    fireEvent.click(screen.getByText('30%'));
    // In edit mode we see a number input prefilled with the value
    expect(screen.getByRole('spinbutton')).toHaveValue(30);
  });

  test('Enter commits the typed value through onCommit', () => {
    const onCommit = vi.fn();
    render(<ProgressCell value={30} onCommit={onCommit} />);
    fireEvent.click(screen.getByText('30%'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '65' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(65);
  });

  test('Escape cancels and does not commit', () => {
    const onCommit = vi.fn();
    render(<ProgressCell value={30} onCommit={onCommit} />);
    fireEvent.click(screen.getByText('30%'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    // Back to display mode with original value
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  test('clamps typed values outside 0..100', () => {
    const onCommit = vi.fn();
    render(<ProgressCell value={20} onCommit={onCommit} />);
    fireEvent.click(screen.getByText('20%'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  test('done=true locks the display — click does not enter edit mode', () => {
    const onCommit = vi.fn();
    render(<ProgressCell value={100} done onCommit={onCommit} />);
    fireEvent.click(screen.getByText('100%'));
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('disabled prevents entering edit mode', () => {
    const onCommit = vi.fn();
    render(<ProgressCell value={50} disabled onCommit={onCommit} />);
    fireEvent.click(screen.getByText('50%'));
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  test('prop updates reflect immediately in display', () => {
    const { rerender } = render(<ProgressCell value={10} onCommit={() => {}} />);
    expect(screen.getByText('10%')).toBeInTheDocument();
    rerender(<ProgressCell value={75} onCommit={() => {}} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
