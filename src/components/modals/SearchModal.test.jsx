import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchModal } from './SearchModal.jsx';

const mkTask = (overrides = {}) => ({
  id: 't1', name: 'API refactor', points: 5, people: 'Alice',
  expectedEnd: '2026-04-20', actualEnd: '',
  ...overrides,
});
const mkTodo = (overrides = {}) => ({
  id: 'td1', title: 'Fix login bug', assignee: 'Bob',
  dueDate: '2026-04-18', priority: 'high', tags: ['ui'],
  status: 'doing',
  ...overrides,
});

describe('SearchModal', () => {
  test('renders initial corpus (no query)', () => {
    render(
      <SearchModal
        tasks={[mkTask({ name: 'API refactor' })]}
        todos={[mkTodo({ title: 'Fix login bug' })]}
        endStatusId="done"
        today="2026-04-19"
        onClose={() => {}}
      />
    );
    expect(screen.getByText('API refactor')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  test('fuzzy-searches by title', () => {
    render(
      <SearchModal
        tasks={[mkTask({ name: 'API refactor' }), mkTask({ id: 't2', name: 'UI spec' })]}
        todos={[]}
        endStatusId="done"
        today="2026-04-19"
        onClose={() => {}}
      />
    );
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.change(input, { target: { value: 'refactor' } });
    expect(screen.getByText('API refactor')).toBeInTheDocument();
    expect(screen.queryByText('UI spec')).not.toBeInTheDocument();
  });

  test('incomplete todos rank above tasks and completed todos', () => {
    const incomplete = mkTodo({ id: 'td1', title: 'Incomplete todo', status: 'doing' });
    const completed = mkTodo({ id: 'td2', title: 'Done todo', status: 'done-status-id' });
    const taskA = mkTask({ id: 'ta', name: 'Task A' });
    render(
      <SearchModal
        tasks={[taskA]}
        todos={[completed, incomplete]}  // note: incomplete second in source
        endStatusId="done-status-id"
        today="2026-04-19"
        onClose={() => {}}
      />
    );
    // First rendered result should be the incomplete todo regardless of input order.
    const results = screen.getAllByText(/Incomplete todo|Done todo|Task A/);
    expect(results[0].textContent).toBe('Incomplete todo');
  });

  test('Escape triggers onClose', () => {
    const onClose = vi.fn();
    render(
      <SearchModal
        tasks={[mkTask()]}
        todos={[]}
        endStatusId="done"
        today="2026-04-19"
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('Enter on a highlighted task invokes onPickTask', () => {
    const onPickTask = vi.fn();
    const onClose = vi.fn();
    const task = mkTask({ id: 't1', name: 'Only task' });
    render(
      <SearchModal
        tasks={[task]}
        todos={[]}
        endStatusId="done"
        today="2026-04-19"
        onPickTask={onPickTask}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onPickTask).toHaveBeenCalledWith(task);
    expect(onClose).toHaveBeenCalled();
  });

  test('Enter on a highlighted todo invokes onPickTodo', () => {
    const onPickTodo = vi.fn();
    const todo = mkTodo({ id: 'td1', title: 'Only todo' });
    render(
      <SearchModal
        tasks={[]}
        todos={[todo]}
        endStatusId="done"
        today="2026-04-19"
        onPickTodo={onPickTodo}
        onClose={() => {}}
      />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onPickTodo).toHaveBeenCalledWith(todo);
  });

  test('ArrowDown moves highlight to next item', () => {
    const onPickTask = vi.fn();
    render(
      <SearchModal
        tasks={[
          mkTask({ id: 't1', name: 'First' }),
          mkTask({ id: 't2', name: 'Second' }),
        ]}
        todos={[]}
        endStatusId="done"
        today="2026-04-19"
        onPickTask={onPickTask}
        onClose={() => {}}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onPickTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });

  test('shows "No matches" when fuse returns zero', () => {
    render(
      <SearchModal
        tasks={[mkTask({ name: 'API refactor' })]}
        todos={[]}
        endStatusId="done"
        today="2026-04-19"
        onClose={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'zzzzzz' } });
    expect(screen.getByText(/No matches/)).toBeInTheDocument();
  });
});
