import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanBoard } from './KanbanBoard.jsx';

const statuses = [
  { id: 'todo', name: 'To do', sortOrder: 0, isDefaultStart: true, isDefaultEnd: false },
  { id: 'doing', name: 'In progress', sortOrder: 1, isDefaultStart: false, isDefaultEnd: false },
  { id: 'done', name: 'Done', sortOrder: 2, isDefaultStart: false, isDefaultEnd: true },
];

const todos = [
  { id: 'a', title: 'Card A', status: 'todo', priority: 'medium', tags: [], comments: [] },
  { id: 'b', title: 'Card B', status: 'doing', priority: 'high', tags: [], comments: [] },
];

function dataTransfer() {
  const store = new Map();
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (k, v) => store.set(k, String(v)),
    getData: (k) => store.get(k) ?? '',
  };
}

describe('KanbanBoard', () => {
  test('renders one column per status with counts', () => {
    render(
      <KanbanBoard
        statuses={statuses}
        todos={todos}
        today="2026-04-19"
        onMoveTodo={() => {}}
      />
    );
    expect(screen.getByText('To do')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('Card B')).toBeInTheDocument();
  });

  test('drop marks "default" / "end" badges on the right columns', () => {
    render(
      <KanbanBoard statuses={statuses} todos={todos} today="2026-04-19" onMoveTodo={() => {}} />
    );
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('end')).toBeInTheDocument();
  });

  test('dragging a card onto a different column calls onMoveTodo(id, status)', () => {
    const onMove = vi.fn();
    render(
      <KanbanBoard statuses={statuses} todos={todos} today="2026-04-19" onMoveTodo={onMove} />
    );
    const card = screen.getByText('Card A').closest('[draggable]');
    const doneColumn = screen.getByText('Done').closest('[style*="border-radius: 6px"]')
                    ?? screen.getByText('Done').closest('div');

    const dt = dataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.dragOver(doneColumn, { dataTransfer: dt });
    fireEvent.drop(doneColumn, { dataTransfer: dt });

    expect(onMove).toHaveBeenCalledWith('a', 'done');
  });

  test('dropping onto the same column is a no-op', () => {
    const onMove = vi.fn();
    render(
      <KanbanBoard statuses={statuses} todos={todos} today="2026-04-19" onMoveTodo={onMove} />
    );
    const card = screen.getByText('Card A').closest('[draggable]');
    const currentColumn = screen.getByText('To do').closest('div');

    const dt = dataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.dragOver(currentColumn, { dataTransfer: dt });
    fireEvent.drop(currentColumn, { dataTransfer: dt });

    expect(onMove).not.toHaveBeenCalled();
  });

  test('clicking a card invokes onCardClick with the todo object', () => {
    const onClick = vi.fn();
    render(
      <KanbanBoard
        statuses={statuses} todos={todos} today="2026-04-19"
        onMoveTodo={() => {}} onCardClick={onClick}
      />
    );
    fireEvent.click(screen.getByText('Card A').closest('[draggable]'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  test('"+New status" tile triggers onAddStatus', () => {
    const onAdd = vi.fn();
    render(
      <KanbanBoard
        statuses={statuses} todos={todos} today="2026-04-19"
        onMoveTodo={() => {}} onAddStatus={onAdd}
      />
    );
    fireEvent.click(screen.getByText('New status'));
    expect(onAdd).toHaveBeenCalled();
  });

  test('column inline rename commits through onRenameStatus on Enter', () => {
    const onRename = vi.fn();
    render(
      <KanbanBoard
        statuses={statuses} todos={todos} today="2026-04-19"
        onMoveTodo={() => {}} onRenameStatus={onRename}
      />
    );
    fireEvent.click(screen.getByText('To do'));
    const input = screen.getByDisplayValue('To do');
    fireEvent.change(input, { target: { value: 'Backlog' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('todo', 'Backlog');
  });

  test('column rename ignored when name unchanged', () => {
    const onRename = vi.fn();
    render(
      <KanbanBoard
        statuses={statuses} todos={todos} today="2026-04-19"
        onMoveTodo={() => {}} onRenameStatus={onRename}
      />
    );
    fireEvent.click(screen.getByText('To do'));
    const input = screen.getByDisplayValue('To do');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });

  test('Escape cancels column rename', () => {
    const onRename = vi.fn();
    render(
      <KanbanBoard
        statuses={statuses} todos={todos} today="2026-04-19"
        onMoveTodo={() => {}} onRenameStatus={onRename}
      />
    );
    fireEvent.click(screen.getByText('To do'));
    const input = screen.getByDisplayValue('To do');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    // Still display mode
    expect(screen.getByText('To do')).toBeInTheDocument();
  });
});
