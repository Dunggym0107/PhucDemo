import type { TaskListItem, TaskListEntry } from './types';

export function groupByBatch(items: TaskListItem[]): TaskListEntry[] {
  const batches = new Map<string, TaskListItem[]>();
  const singles: TaskListItem[] = [];

  for (const item of items) {
    if (item.batch_id) {
      const arr = batches.get(item.batch_id) ?? [];
      arr.push(item);
      batches.set(item.batch_id, arr);
    } else {
      singles.push(item);
    }
  }

  const entries: TaskListEntry[] = [];
  for (const [batchId, children] of batches) {
    const representative = children.reduce((acc, x) => {
      if (acc.is_overdue && !x.is_overdue) return acc;
      if (!acc.is_overdue && x.is_overdue) return x;
      const a = new Date(acc.due_date ?? acc.created_at).getTime();
      const b = new Date(x.due_date ?? x.created_at).getTime();
      return a < b ? acc : x;
    });
    entries.push({ kind: 'batch', batchId, children, representative });
  }
  for (const s of singles) {
    entries.push({ kind: 'batch', batchId: null, children: [s], representative: s });
  }

  return entries.sort((a, b) => {
    const ra = a.representative;
    const rb = b.representative;
    if (ra.is_overdue && !rb.is_overdue) return -1;
    if (!ra.is_overdue && rb.is_overdue) return 1;
    const da = new Date(ra.due_date ?? ra.created_at).getTime();
    const db = new Date(rb.due_date ?? rb.created_at).getTime();
    return da - db;
  });
}

export function batchProgress(children: TaskListItem[]) {
  const total = children.length;
  const done = children.filter(c => c.status === 'done').length;
  const submitted = children.filter(c => c.status === 'submitted').length;
  const doing = children.filter(c => c.status === 'doing').length;
  const todo = children.filter(c => c.status === 'todo').length;
  const canceled = children.filter(c => c.status === 'canceled').length;
  const overdue = children.filter(c => c.is_overdue).length;
  return { total, done, submitted, doing, todo, canceled, overdue };
}
