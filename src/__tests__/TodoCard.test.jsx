import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TodoCard from '../components/TodoCard';

const baseTodo = {
  id: 'todo-1',
  title: '測試任務',
  priority: 'medium',
  assignee: '',
  dueDate: '',
  tags: [],
  linkedTaskId: null,
};

const defaultProps = {
  isDone: false,
  onEdit: vi.fn(),
  onDragStart: vi.fn(),
  onDragEnd: vi.fn(),
  allTasks: [],
};

describe('TodoCard', () => {
  it('renders todo title and priority badge', () => {
    render(<TodoCard todo={baseTodo} {...defaultProps} />);

    expect(screen.getByText('測試任務')).toBeInTheDocument();
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('renders high priority style', () => {
    const todo = { ...baseTodo, priority: 'high' };
    render(<TodoCard todo={todo} {...defaultProps} />);
    expect(screen.getByText('高')).toBeInTheDocument();
  });

  it('renders low priority style', () => {
    const todo = { ...baseTodo, priority: 'low' };
    render(<TodoCard todo={todo} {...defaultProps} />);
    expect(screen.getByText('低')).toBeInTheDocument();
  });

  it('shows assignee avatar and name', () => {
    const todo = { ...baseTodo, assignee: 'Alice' };
    render(<TodoCard todo={todo} {...defaultProps} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows due date', () => {
    const todo = { ...baseTodo, dueDate: '2024-03-15' };
    render(<TodoCard todo={todo} {...defaultProps} />);
    expect(screen.getByText('03/15')).toBeInTheDocument();
  });

  it('shows overdue style for past due date', () => {
    const todo = { ...baseTodo, dueDate: '2020-01-01' };
    const { container } = render(<TodoCard todo={todo} {...defaultProps} />);
    const dueDateSpan = container.querySelector('.text-red-500');
    expect(dueDateSpan).toBeInTheDocument();
  });

  it('does not show overdue style when isDone', () => {
    const todo = { ...baseTodo, dueDate: '2020-01-01' };
    const { container } = render(<TodoCard todo={todo} {...defaultProps} isDone={true} />);
    const dueDateSpan = container.querySelector('.text-red-500');
    expect(dueDateSpan).toBeNull();
  });

  it('shows linked task name when task exists', () => {
    const todo = { ...baseTodo, linkedTaskId: 'task-1' };
    const allTasks = [{ id: 'task-1', name: 'API 設計' }];
    render(<TodoCard todo={todo} {...defaultProps} allTasks={allTasks} />);
    expect(screen.getByText('🔗 API 設計')).toBeInTheDocument();
  });

  it('shows fallback text when linked task not found', () => {
    const todo = { ...baseTodo, linkedTaskId: 'task-missing' };
    render(<TodoCard todo={todo} {...defaultProps} allTasks={[]} />);
    expect(screen.getByText('無關聯任務')).toBeInTheDocument();
  });

  it('shows tags', () => {
    const todo = { ...baseTodo, tags: ['bug', 'urgent', 'frontend'] };
    render(<TodoCard todo={todo} {...defaultProps} />);
    expect(screen.getByText('bug +2')).toBeInTheDocument();
  });

  it('shows single tag without count', () => {
    const todo = { ...baseTodo, tags: ['bug'] };
    render(<TodoCard todo={todo} {...defaultProps} />);
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('calls onEdit when clicked', () => {
    const onEdit = vi.fn();
    render(<TodoCard todo={baseTodo} {...defaultProps} onEdit={onEdit} />);

    fireEvent.click(screen.getByText('測試任務'));
    expect(onEdit).toHaveBeenCalledWith(baseTodo);
  });

  it('calls onDragStart on drag', () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <TodoCard todo={baseTodo} {...defaultProps} onDragStart={onDragStart} />,
    );

    const card = container.firstChild;
    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    expect(onDragStart).toHaveBeenCalledWith('todo-1');
  });

  it('applies opacity when isDone', () => {
    const { container } = render(<TodoCard todo={baseTodo} {...defaultProps} isDone={true} />);
    expect(container.firstChild.className).toContain('opacity-50');
  });
});
