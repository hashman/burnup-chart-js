const ASSIGNEE_COLORS = [
  'bg-rose-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-indigo-400',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

export function assigneeColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ASSIGNEE_COLORS[Math.abs(hash) % ASSIGNEE_COLORS.length];
}
