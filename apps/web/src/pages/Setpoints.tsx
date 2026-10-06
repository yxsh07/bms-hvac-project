import React, { useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { SetpointRequestDetail } from '../components/SetpointRequestDetail';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import type { UserRole } from '../types/auth';
import type { PointDefinition } from '@/types/telemetry';
import { MOCK_REQUESTS, DEFAULT_PROPOSAL } from '../fixtures/setpointsData';
import type { SetpointRequest } from '../fixtures/setpointsData';
const STATUS_LABELS: Record<SetpointRequest['status'], string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  APPLYING: 'Applying',
  APPLIED: 'Applied',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  REVERTED: 'Reverted',
  EXPIRED: 'Expired'
};

const STATUS_COLORS: Record<SetpointRequest['status'], string> = {
  DRAFT: 'bg-surface-sunken text-content-tertiary',
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-chilled/10 text-chilled',
  APPLYING: 'bg-chilled/10 text-chilled animate-pulse',
  APPLIED: 'bg-success/10 text-success',
  FAILED: 'bg-critical/10 text-critical',
  REJECTED: 'bg-critical/10 text-critical',
  REVERTED: 'bg-success/10 text-success',
  EXPIRED: 'bg-surface-sunken text-content-tertiary'
};


const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  engineer: 'HVAC Engineer',
  facility_manager: 'Facility Manager',
  operator: 'Operator',
  executive: 'Executive'
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'failed', label: 'Failed/Rejected' },
  { value: 'reverted', label: 'Reverted' }
];

export function Setpoints() {
  const { hasPermission, user } = useAuth();
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Set-points' }
  ];

  const [requests] = useState<SetpointRequest[]>(MOCK_REQUESTS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'applying' | 'applied' | 'failed' | 'reverted'>('all');
  const [selectedRequest, setSelectedRequest] = useState<SetpointRequest | null>(null);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    asset: string;
    point: string;
    currentValue: string;
    unit: string;
    pointDefinition: PointDefinition;
  } | null>(null);

  const canPropose = hasPermission('setpoints:propose');
  const canApprove = hasPermission('setpoints:approve');

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    if (filter === 'pending') return req.status === 'PENDING';
    if (filter === 'approved') return req.status === 'APPROVED';
    if (filter === 'applying') return req.status === 'APPLYING';
    if (filter === 'applied') return req.status === 'APPLIED';
    if (filter === 'failed') return req.status === 'FAILED' || req.status === 'REJECTED';
    if (filter === 'reverted') return req.status === 'REVERTED';
    return true;
  });

  const handleProposeClick = useCallback((req?: SetpointRequest) => {
    if (req) {
      // Open detail view
      setSelectedRequest(req);
    } else {
      // Open confirm sheet for new proposal
      // In real app, this would open an asset picker first
      setConfirmData(DEFAULT_PROPOSAL);
      setConfirmSheetOpen(true);
    }
  }, []);

  const handleConfirmSubmit = useCallback((data: { newValue: string; justification: string; effectiveWindow?: { start: string; end: string }; revertTime?: string }) => {
    console.log('Setpoint request submitted:', { ...confirmData, ...data });
    setConfirmSheetOpen(false);
    setConfirmData(null);
    // In real app, this would call the API to create the request
  }, [confirmData]);

  const handleCloseConfirmSheet = useCallback(() => {
    setConfirmSheetOpen(false);
    setConfirmData(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRequest(null);
  }, []);

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    requests.forEach(req => {
      counts[req.status] = (counts[req.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-semibold text-content-primary">Set-point Requests</h1>
                <p className="text-sm text-content-tertiary">Full workflow: Propose → Approve → Apply → Read-back → Revert. All actions audited.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleProposeClick()}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
                    canPropose ? 'bg-chilled text-white hover:opacity-90' : 'bg-content-disabled text-content-inverse cursor-not-allowed'
                  )}
                  disabled={!canPropose}
                  title={!canPropose ? 'Your role cannot propose set-point changes' : ''}
                >
                  Propose Change
                </button>
              </div>
            </div>

            {/* Status filter tabs with counts */}
            <div className="flex items-center gap-1 bg-surface-base border border-default rounded-lg p-1 overflow-x-auto">
              {FILTER_OPTIONS.map(opt => {
                let count = 0;
                if (opt.value === 'all') count = requests.length;
                else if (opt.value === 'pending') count = statusCounts.PENDING || 0;
                else if (opt.value === 'approved') count = statusCounts.APPROVED || 0;
                else if (opt.value === 'applying') count = statusCounts.APPLYING || 0;
                else if (opt.value === 'applied') count = statusCounts.APPLIED || 0;
                else if (opt.value === 'failed') count = (statusCounts.FAILED || 0) + (statusCounts.REJECTED || 0);
                else if (opt.value === 'reverted') count = statusCounts.REVERTED || 0;

                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value as typeof filter)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                      filter === opt.value
                        ? 'bg-chilled text-white'
                        : 'text-content-tertiary hover:text-content-primary hover:bg-state-hover'
                    )}
                  >
                    {opt.label} <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium', filter === opt.value ? 'bg-white/20' : 'bg-surface-sunken text-content-tertiary')}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Requests list */}
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center text-content-tertiary">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-content-tertiary/50">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 9h6M9 15h4" />
                  </svg>
                  <p>No requests match the current filter</p>
                </div>
              ) : (
                filteredRequests.map(req => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onClick={() => handleProposeClick(req)}
                    canPropose={canPropose}
                    canApprove={canApprove}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Sheet Portal */}
      {confirmSheetOpen && confirmData && (
        <ConfirmSheet
          isOpen={confirmSheetOpen}
          onClose={handleCloseConfirmSheet}
          onConfirm={handleConfirmSubmit}
          assetName={confirmData.asset}
          pointDisplayName={confirmData.point}
          currentValue={confirmData.currentValue}
          pointDefinition={confirmData.pointDefinition}
          unit={confirmData.unit}
          safeMin={confirmData.pointDefinition.safeMin}
          safeMax={confirmData.pointDefinition.safeMax}
        />
      )}

      {/* Detail Modal Portal */}
      {selectedRequest && (
        <SetpointRequestDetail
          request={selectedRequest}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

function RequestCard({ request, onClick, canPropose, canApprove }: { request: SetpointRequest; onClick: () => void; canPropose: boolean; canApprove: boolean }) {
  const isPending = request.status === 'PENDING';
  const isApproved = request.status === 'APPROVED';
  const isApplying = request.status === 'APPLYING';
  const isApplied = request.status === 'APPLIED';
  const isFailed = request.status === 'FAILED' || request.status === 'REJECTED';
  const isReverted = request.status === 'REVERTED';

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-4 rounded-lg border transition-colors cursor-pointer',
        'bg-surface-base border-default hover:bg-state-hover'
      )}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      aria-label={`View details for ${request.asset} ${request.point} request`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-content-primary truncate">{request.asset}</span>
            <span className="text-content-tertiary text-sm">{request.point}</span>
          </div>
          <p className="text-xs text-content-tertiary mt-0.5 truncate">{request.justification}</p>
        </div>
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', STATUS_COLORS[request.status])}>
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap mb-2">
        <div className="flex items-center gap-1 text-content-tertiary">
          <span>Current:</span>
          <span className="font-mono tabular-nums text-content-primary">{request.currentValue}</span>
        </div>
        <div className="flex items-center gap-1 text-content-tertiary">
          <span>Requested:</span>
          <span className="font-mono tabular-nums text-chilled">{request.requestedValue}</span>
        </div>
        <div className="flex items-center gap-1 text-content-tertiary">
          <span>By:</span>
          <span className="text-content-secondary">{request.requester}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-sunken text-content-tertiary">{ROLE_LABELS[request.requesterRole]}</span>
        </div>
        <div className="flex items-center gap-1 text-content-tertiary">
          <span>At:</span>
          <span className="font-mono tabular-nums">{formatTime(request.requestedAt)}</span>
        </div>
      </div>

      {/* Progress indicator for pending/approved/applying */}
      {(isPending || isApproved || isApplying) && (
        <div className="pt-2 border-t border-default">
          <div className="flex items-center gap-2 mb-1">
            <ProgressStep label="Proposed" completed={true} current={isPending} />
            <ProgressConnector completed={!isPending} />
            <ProgressStep label="Approved" completed={isApproved || isApplying || isApplied || isReverted} current={isApproved} />
            <ProgressConnector completed={isApplying || isApplied || isReverted} />
            <ProgressStep label="Applying" completed={isApplied || isReverted} current={isApplying} />
            <ProgressConnector completed={isApplied || isReverted} />
            <ProgressStep label="Applied" completed={isApplied || isReverted} current={isApplied} />
          </div>
        </div>
      )}

      {/* Approver info for approved+ */}
      {(isApproved || isApplying || isApplied || isReverted || isFailed) && request.approver && (
        <div className="pt-2 border-t border-default text-sm text-content-tertiary">
          Approved by: <span className="text-content-secondary">{request.approver}</span> ({ROLE_LABELS[request.approverRole as UserRole] || request.approverRole}) at {formatTime(request.approvedAt!)}
        </div>
      )}

      {/* Read-back result for applied/failed */}
      {(isApplied || isFailed || isReverted) && request.readbackValue && (
        <div className="pt-2 border-t border-default">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-content-tertiary">Read-back:</span>
            <span className={clsx('font-mono tabular-nums', request.readbackMatch ? 'text-success' : 'text-critical')}>
              {request.readbackValue}
            </span>
            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              request.readbackMatch ? 'bg-success/10 text-success' : 'bg-critical/10 text-critical'
            )}>
              {request.readbackMatch ? 'Match ✓' : 'Mismatch ✗'}
            </span>
          </div>
        </div>
      )}

      {/* Revert info */}
      {isReverted && request.revertReadbackValue && (
        <div className="pt-2 border-t border-default">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-content-tertiary">Revert read-back:</span>
            <span className={clsx('font-mono tabular-nums', request.revertReadbackMatch ? 'text-success' : 'text-critical')}>
              {request.revertReadbackValue}
            </span>
            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              request.revertReadbackMatch ? 'bg-success/10 text-success' : 'bg-critical/10 text-critical'
            )}>
              {request.revertReadbackMatch ? 'Match ✓' : 'Mismatch ✗'}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons for pending (if user can approve) */}
      {isPending && canApprove && (
        <div className="pt-2 border-t border-default flex items-center justify-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); console.log('Reject', request.id); }}
            className="px-3 py-1.5 text-sm rounded-md border border-critical/20 text-critical bg-critical/5 hover:bg-critical/10 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); console.log('Approve', request.id); }}
            className="px-3 py-1.5 text-sm rounded-md bg-chilled text-white hover:opacity-90 transition-colors"
          >
            Approve
          </button>
        </div>
      )}

      {/* Idempotency key */}
      <div className="pt-2 border-t border-default text-xs text-content-tertiary flex items-center justify-between">
        <span>Idempotency: <span className="font-mono">{request.idempotencyKey.slice(0, 12)}…</span></span>
        <span className="text-content-disabled">Click for full timeline</span>
      </div>
    </div>
  );
}

function ProgressStep({ label, completed, current }: { label: string; completed: boolean; current: boolean }) {
  return (
    <div className="flex flex-col items-center flex-1 relative">
      <div className={clsx(
        'w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-colors',
        completed ? 'bg-success border-success' :
        current ? 'bg-chilled border-chilled animate-pulse' :
        'bg-surface-base border-default'
      )} />
      <span className={clsx('text-[10px] font-medium mt-1 text-center',
        completed ? 'text-success' :
        current ? 'text-chilled' :
        'text-content-tertiary'
      )}>{label}</span>
    </div>
  );
}

function ProgressConnector({ completed }: { completed: boolean }) {
  return (
    <div className={clsx(
      'flex-1 h-0.5 rounded flex-shrink-0 transition-colors',
      completed ? 'bg-success' : 'bg-border-default'
    )} />
  );
}
