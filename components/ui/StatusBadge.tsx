const MAP: Record<string, string> = {
  pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected',
  completed: 'badge-completed', running: 'badge-running', available: 'badge-available',
  reserved: 'badge-reserved', dispatched: 'badge-dispatched', urgent: 'badge-urgent',
  cancelled: 'badge-grey', pass: 'badge-approved', reject: 'badge-rejected',
  active: 'badge-approved', inactive: 'badge-grey', maintenance: 'badge-pending',
  processing: 'badge-running', rework: 'badge-pending',
  low: 'badge-grey', medium: 'badge-info', high: 'badge-pending',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = MAP[(status || '').toLowerCase()] || 'badge-grey';
  return <span className={`badge ${cls}`}>{status}</span>;
}
