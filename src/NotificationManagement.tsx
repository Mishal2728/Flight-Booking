import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  AlertCircle, ArrowDown, CalendarDays, Check, ChevronLeft, ChevronRight,
  Clock3, Eye, MessageCircle, RefreshCw, Search, ShieldAlert, X,
} from 'lucide-react';
import { api, USE_MOCK_API, type Inquiry, type NotificationOutbox, type OutboxStatus } from './services/apiClient';
import './notification-management.css';

type NotificationRecord = { inquiry: Inquiry; outbox: NotificationOutbox };
type NotificationManagementProps = { canRetry: boolean };
type OutboxSummary = { outboxPending: number };

const statuses: OutboxStatus[] = ['pending', 'processing', 'sent', 'retry', 'dead'];
const events = ['inquiry_created', 'status_changed'] as const;
const statusLabel: Record<OutboxStatus, string> = {
  pending: 'Pending', processing: 'Processing', sent: 'Sent', retry: 'Retry', dead: 'Dead',
};
const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const routeFor = (record: NotificationRecord) => {
  const snapshot = record.inquiry.itinerary_snapshot || {};
  const route = [snapshot.origin, snapshot.destination].filter(Boolean).join(' → ');
  return route || String(record.outbox.payload?.route || '—');
};

export function NotificationManagement({ canRetry }: NotificationManagementProps) {
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [summary, setSummary] = useState<OutboxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OutboxStatus | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationRecord | null>(null);
  const [retryTarget, setRetryTarget] = useState<NotificationRecord | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const pageSize = 10;

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError('');
    const [inquiryResult, summaryResult] = await Promise.allSettled([api.listInquiries(), api.stats()]);
    if (inquiryResult.status === 'fulfilled') setInquiries(inquiryResult.value);
    else {
      setInquiries(null);
      setLoadError(inquiryResult.reason instanceof Error ? inquiryResult.reason.message : 'Notification records could not be loaded.');
    }
    if (summaryResult.status === 'fulfilled') setSummary({ outboxPending: summaryResult.value.outboxPending });
    else setSummary(null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void refresh(true); }, [refresh]);

  const records = useMemo<NotificationRecord[]>(() => (inquiries || []).flatMap(inquiry =>
    inquiry.outbox ? [{ inquiry, outbox: inquiry.outbox }] : []), [inquiries]);
  const coverageComplete = inquiries !== null && (inquiries.length === 0 || inquiries.every(inquiry => Boolean(inquiry.outbox)));
  const coveragePartial = inquiries !== null && records.length > 0 && !coverageComplete;
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter(record => {
      const route = routeFor(record);
      const searchMatch = !needle || [record.inquiry.customer_name, record.inquiry.customer_email,
        record.inquiry.customer_phone, record.outbox.recipient, record.outbox.id,
        record.inquiry.id, record.outbox.event_type, route].some(value => String(value || '').toLowerCase().includes(needle));
      const statusMatch = statusFilter === 'all' || record.outbox.status === statusFilter;
      const eventMatch = eventFilter === 'all' || record.outbox.event_type === eventFilter;
      const createdDate = record.outbox.created_at?.slice(0, 10) || '';
      const fromMatch = !dateFrom || createdDate >= dateFrom;
      const toMatch = !dateTo || createdDate <= dateTo;
      return searchMatch && statusMatch && eventMatch && fromMatch && toMatch;
    }).sort((a, b) => (b.outbox.created_at || '').localeCompare(a.outbox.created_at || ''));
  }, [records, search, statusFilter, eventFilter, dateFrom, dateTo]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const count = (status: OutboxStatus) => records.filter(record => record.outbox.status === status).length;
  const metrics = [
    { label: 'Total notifications', value: coverageComplete ? records.length : null, note: coverageComplete ? 'Records exposed by inquiry API' : 'History unavailable', icon: MessageCircle, tone: 'navy' },
    { label: 'Sent successfully', value: coverageComplete ? count('sent') : null, note: 'Confirmed by stored status', icon: Check, tone: 'green' },
    { label: 'Pending notifications', value: coverageComplete ? count('pending') : (summary?.outboxPending ?? null), note: coverageComplete ? 'Awaiting worker delivery' : 'Backend aggregate; not state-split', icon: Clock3, tone: 'amber' },
    { label: 'Failed notifications', value: coverageComplete ? count('retry') + count('dead') : null, note: 'Retrying or exhausted', icon: AlertCircle, tone: 'red' },
    { label: 'Notifications in retry', value: coverageComplete ? count('retry') : null, note: 'Scheduled for another attempt', icon: RefreshCw, tone: 'blue' },
    { label: 'Dead notifications', value: coverageComplete ? count('dead') : null, note: 'Maximum attempts reached', icon: ShieldAlert, tone: 'red' },
  ];

  const retry = async () => {
    if (!retryTarget || !canRetry) return;
    const target = retryTarget;
    setRetryingId(target.outbox.id);
    setFeedback(null);
    try {
      // Reuse the existing inquiry-scoped retry endpoint through the API client.
      await api.advanceOutbox(target.inquiry.id);
      setRetryTarget(null);
      setSelected(null);
      await refresh();
      setFeedback({ kind: 'success', text: USE_MOCK_API ? 'Local mock record updated. No live backend was contacted.' : 'Retry request accepted by the backend.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Retry failed. Please try again.' });
    } finally {
      setRetryingId(null);
    }
  };

  const retryable = (record: NotificationRecord) => canRetry && ['retry', 'dead'].includes(record.outbox.status);

  return (
    <section className="notification-manager" aria-labelledby="notification-title">
      <div className="notification-heading">
        <div>
          <div className="notification-eyebrow"><MessageCircle size={14} /> DELIVERY OPERATIONS</div>
          <h1 id="notification-title">WhatsApp notifications</h1>
          <p>Inspect notification metadata attached to inquiry records. This view only displays data returned by the current API client; it does not create notification history.</p>
        </div>
        <button className="notification-refresh" type="button" onClick={() => void refresh()} disabled={refreshing || loading}>
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="notification-metrics">
        {metrics.map((metric, index) => <motion.article className={`notification-metric ${metric.tone}`} key={metric.label}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, delay: index * .045 }}>
          <div className="notification-metric-top"><span>{metric.label}</span><i><metric.icon size={15} /></i></div>
          <div className="notification-metric-value">{loading ? <span className="notification-skeleton" /> : metric.value === null ? '—' : <AnimatedCount value={metric.value} />}</div>
          <small>{metric.note}</small>
        </motion.article>)}
      </div>

      {inquiries !== null && !coverageComplete && <div className="notification-data-note"><AlertCircle size={16} /><span><b>History data is limited.</b> The documented API has an inquiry list and retry action, but no dedicated notification-history endpoint. {summary ? 'The pending aggregate is shown as returned; status-level counts are unavailable unless each inquiry includes its stored outbox record.' : 'The aggregate statistic is also unavailable right now.'}</span></div>}
      {coveragePartial && <div className="notification-data-note"><AlertCircle size={16} /><span>Partial outbox metadata: {records.length} of {inquiries?.length || 0} inquiries returned a notification record. Only those returned records appear below.</span></div>}
      {loadError && <div className="notification-error" role="alert"><AlertCircle size={17} /><span>Couldn’t load notification history. {loadError}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {feedback && <div className={`notification-feedback ${feedback.kind}`} role="status"><span>{feedback.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setFeedback(null)}><X size={15} /></button></div>}

      <div className="notification-toolbar">
        <label className="notification-search"><Search size={15} /><input aria-label="Search notifications" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search guest, route, recipient or ID" /></label>
        <label>Status<select aria-label="Filter by status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as OutboxStatus | 'all'); setPage(1); }}><option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
        <label>Event type<select aria-label="Filter by event type" value={eventFilter} onChange={event => { setEventFilter(event.target.value); setPage(1); }}><option value="all">All events</option>{events.map(event => <option key={event} value={event}>{event.replace(/_/g, ' ')}</option>)}</select></label>
        <label className="notification-date"><CalendarDays size={14} /><input aria-label="Created from date" type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} /></label>
        <label className="notification-date"><ArrowDown size={14} /><input aria-label="Created to date" type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} /></label>
      </div>

      <div className="notification-table-card">
        <div className="notification-table-heading"><div><b>Notification history</b><span>{loading ? 'Loading records…' : `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'} · newest first`}</span></div><span className="notification-retention"><span /> {USE_MOCK_API ? 'Local mock adapter · not live backend' : 'Backend inquiry records'}</span></div>
        {loading ? <div className="notification-loading"><span /><span /><span /></div> : inquiries === null ? null : records.length === 0 ? (
          inquiries.length > 0 ? <div className="notification-empty"><MessageCircle size={24} /><b>Notification history isn’t exposed by this response</b><p>The inquiry list returned {inquiries.length} inquiries without outbox records. No synthetic rows have been added.</p></div> :
          <div className="notification-empty"><MessageCircle size={24} /><b>No WhatsApp notifications yet</b><p>Notifications will appear here when the backend returns outbox data with an inquiry.</p></div>
        ) : filtered.length === 0 ? <div className="notification-empty"><Search size={22} /><b>No records match these filters</b><p>Adjust the search, status, event type, or date range.</p></div> : <>
          <div className="notification-table-wrap">
            <table className="notification-table">
              <thead><tr><th>Customer</th><th>Event · route</th><th>Status</th><th>Attempts</th><th>Created</th><th>Sent</th><th>Actions</th></tr></thead>
              <tbody>{pageItems.map((record, index) => <motion.tr key={record.outbox.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, delay: index * .025 }}>
                <td><b>{record.inquiry.customer_name || '—'}</b><small>{record.inquiry.customer_phone || '—'}</small></td>
                <td><b className="notification-event">{record.outbox.event_type.replace(/_/g, ' ')}</b><small>{routeFor(record)}</small></td>
                <td><StatusTag status={record.outbox.status} /></td>
                <td>{record.outbox.attempts} <span className="notification-attempt-max">/ {record.outbox.max_attempts}</span></td>
                <td>{formatDate(record.outbox.created_at)}</td><td>{formatDate(record.outbox.sent_at)}</td>
                <td><div className="notification-row-actions"><button type="button" aria-label={`View notification ${record.outbox.id}`} title="View details" onClick={() => setSelected(record)}><Eye size={15} /></button>{retryable(record) && <button type="button" className="notification-retry-icon" aria-label={`Retry notification ${record.outbox.id}`} title="Retry notification" onClick={() => setRetryTarget(record)}><RefreshCw size={14} /></button>}</div></td>
              </motion.tr>)}</tbody>
            </table>
          </div>
          <div className="notification-mobile-list">{pageItems.map(record => <article className="notification-mobile-card" key={`mobile-${record.outbox.id}`}>
            <div><StatusTag status={record.outbox.status} /><small>{formatDate(record.outbox.created_at)}</small></div>
            <b>{record.inquiry.customer_name || '—'}</b><span>{record.inquiry.customer_phone || '—'}</span><span>{routeFor(record)} · {record.outbox.event_type.replace(/_/g, ' ')}</span>
            <div className="notification-mobile-actions"><button type="button" onClick={() => setSelected(record)}>View details <ChevronRight size={14} /></button>{retryable(record) && <button type="button" onClick={() => setRetryTarget(record)}>Retry <RefreshCw size={13} /></button>}</div>
          </article>)}</div>
          <div className="notification-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><span>{page} / {pageCount}</span><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><ChevronRight size={16} /></button></div></div>
        </>}
      </div>

      <AnimatePresence>{selected && <NotificationDrawer record={selected} canRetry={retryable(selected)} onClose={() => setSelected(null)} onRetry={() => setRetryTarget(selected)} />}</AnimatePresence>
      <AnimatePresence>{retryTarget && <motion.div className="notification-confirm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => retryingId === null && setRetryTarget(null)}>
        <motion.div className="notification-confirm" role="alertdialog" aria-modal="true" aria-labelledby="notification-retry-title" initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} onClick={event => event.stopPropagation()}>
          <button className="notification-close" type="button" aria-label="Close confirmation" onClick={() => setRetryTarget(null)}><X size={17} /></button>
          <div className="notification-confirm-icon"><RefreshCw size={18} /></div><h2 id="notification-retry-title">Retry this notification?</h2>
          <p>{USE_MOCK_API ? <>This will simulate a retry in the local mock adapter for <b>{retryTarget.inquiry.customer_name || retryTarget.inquiry.id}</b>. No backend request will be sent.</> : <>This will ask the existing inquiry retry endpoint to re-queue the notification for <b>{retryTarget.inquiry.customer_name || retryTarget.inquiry.id}</b>.</>}</p>
          <div className="notification-confirm-actions"><button type="button" onClick={() => setRetryTarget(null)} disabled={retryingId !== null}>Cancel</button><button type="button" className="notification-confirm-retry" onClick={() => void retry()} disabled={retryingId !== null}>{retryingId ? <><span className="notification-spinner" /> Retrying…</> : <>Confirm retry <RefreshCw size={14} /></>}</button></div>
        </motion.div>
      </motion.div>}</AnimatePresence>
    </section>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const formatted = useTransform(motionValue, current => Math.round(current).toLocaleString('en-IN'));
  useEffect(() => { const control = animate(motionValue, value, { duration: .55, ease: 'easeOut' }); return () => control.stop(); }, [motionValue, value]);
  return <motion.span>{formatted}</motion.span>;
}

function StatusTag({ status }: { status: OutboxStatus }) {
  return <motion.span className={`notification-status ${status}`} key={status} initial={{ opacity: .55, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .18 }}>{statusLabel[status]}</motion.span>;
}

function NotificationDrawer({ record, canRetry, onClose, onRetry }: {
  record: NotificationRecord; canRetry: boolean; onClose: () => void; onRetry: () => void;
}) {
  const { inquiry, outbox } = record;
  const rawPayload = outbox.payload && typeof outbox.payload === 'object' ? outbox.payload : {};
  const payloadText = [rawPayload.message, rawPayload.body, rawPayload.text].find(value => typeof value === 'string' && value.trim()) as string | undefined;
  const payloadJson = JSON.stringify(rawPayload, null, 2);
  const timeline = [
    { title: 'Outbox record created', value: outbox.created_at, kind: 'created' },
    { title: `Current state · ${statusLabel[outbox.status]}`, value: outbox.status === 'sent' ? outbox.sent_at : outbox.status === 'retry' ? outbox.next_retry_at : null, kind: outbox.status },
  ];
  return <motion.div className="notification-drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.aside className="notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-drawer-title" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 34 }} onClick={event => event.stopPropagation()}>
      <div className="notification-drawer-head"><div><span>NOTIFICATION DETAIL</span><h2 id="notification-drawer-title">Delivery record</h2></div><button className="notification-close" type="button" aria-label="Close details" onClick={onClose}><X size={18} /></button></div>
      <div className="notification-drawer-content">
        <div className="notification-drawer-summary"><StatusTag status={outbox.status} /><span>{outbox.event_type.replace(/_/g, ' ')}</span><small>Created {formatDate(outbox.created_at)}</small></div>
        <section className="notification-detail-section"><h3>Notification and customer</h3><DetailPair label="Notification ID" value={outbox.id} mono /><DetailPair label="Related inquiry ID" value={inquiry.id} mono /><DetailPair label="Event type" value={outbox.event_type} /><DetailPair label="Customer" value={inquiry.customer_name} /><DetailPair label="Email" value={inquiry.customer_email} /><DetailPair label="Customer phone" value={inquiry.customer_phone} /><DetailPair label="Route" value={routeFor(record)} /><DetailPair label="Recipient (as returned)" value={outbox.recipient} /></section>
        <section className="notification-detail-section"><h3>Delivery state</h3><div className="notification-detail-grid"><DetailPair label="Current status" value={statusLabel[outbox.status]} /><DetailPair label="Attempts" value={`${outbox.attempts} / ${outbox.max_attempts}`} /><DetailPair label="Last error" value={outbox.last_error || '—'} /><DetailPair label="Next retry at" value={formatDate(outbox.next_retry_at)} /><DetailPair label="Created at" value={formatDate(outbox.created_at)} /><DetailPair label="Sent at" value={formatDate(outbox.sent_at)} /></div></section>
        <section className="notification-detail-section"><h3>Recorded lifecycle</h3><p className="notification-lifecycle-note">Only the current state and timestamps returned by the API are shown; per-attempt transition history is not exposed.</p><ol className="notification-timeline">{timeline.map((item, index) => <li className={index === timeline.length - 1 ? 'current' : 'complete'} key={`${item.kind}-${index}`}><span className="notification-timeline-marker">{index === 0 ? <Check size={11} /> : <span />}</span><div><b>{item.title}</b><small>{item.value ? formatDate(item.value) : 'No timestamp returned'}</small></div></li>)}</ol></section>
        <section className="notification-detail-section"><h3>Stored message payload</h3><div className="notification-chat"><div className="notification-chat-head"><MessageCircle size={14} /> WhatsApp payload preview <small>{outbox.recipient || 'Recipient not returned'}</small></div><div className="notification-chat-body"><div className="notification-chat-bubble">{payloadText ? <p>{payloadText}</p> : <><small>Message text isn’t included in the returned payload. Raw stored payload:</small><pre>{payloadJson && payloadJson !== '{}' ? payloadJson : 'No payload fields returned.'}</pre></>}<time>{formatDate(outbox.created_at)}</time></div></div><div className="notification-chat-foot">Preview of stored data only · no message template is generated here</div></div>
          <div className="notification-payload-facts">{inquiry.quoted_price && <DetailPair label="Quoted price" value={`${inquiry.currency || ''} ${inquiry.quoted_price}`} />}{inquiry.passenger_count != null && <DetailPair label="Passengers" value={String(inquiry.passenger_count)} />}</div>
        </section>
      </div>
      {canRetry && <div className="notification-drawer-footer"><button type="button" className="notification-confirm-retry" onClick={onRetry}><RefreshCw size={14} /> Retry notification</button><small>{USE_MOCK_API ? 'Mock simulation only; no backend request is sent.' : 'Uses the existing retry endpoint with this inquiry’s ID.'}</small></div>}
    </motion.aside>
  </motion.div>;
}

function DetailPair({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return <div className="notification-detail-pair"><small>{label}</small><b className={mono ? 'mono' : ''}>{value || '—'}</b></div>;
}
