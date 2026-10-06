import React from 'react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import type { UserRole } from '../types/auth';

interface SetpointRequest {
  id: string;
  asset: string;
  point: string;
  currentValue: string;
  requestedValue: string;
  unit: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'APPLYING' | 'APPLIED' | 'FAILED' | 'REJECTED' | 'REVERTED' | 'EXPIRED';
  requester: string;
  requesterRole: UserRole;
  requestedAt: string;
  approver?: string;
  approverRole?: UserRole;
  approvedAt?: string;
  appliedAt?: string;
  readbackValue?: string;
  readbackAt?: string;
  readbackMatch?: boolean;
  justification: string;
  effectiveWindow?: { start: string; end: string };
  revertTime?: string;
  revertedAt?: string;
  revertReadbackValue?: string;
  revertReadbackAt?: string;
  revertReadbackMatch?: boolean;
  idempotencyKey: string;
  safeMin?: number;
  safeMax?: number;
}

interface SetpointRequestDetailProps {
  request: SetpointRequest;
  onClose: () => void;
}

const STATUS_LABELS: Record<SetpointRequest['status'], string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending Approval',
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

const STATUS_ORDER: SetpointRequest['status'][] = [
  'DRAFT', 'PENDING', 'APPROVED', 'APPLYING', 'APPLIED'
];

const REVERT_STATUS_ORDER: SetpointRequest['status'][] = [
  'APPLIED', 'REVERTED'
];

export function SetpointRequestDetail({ request, onClose }: SetpointRequestDetailProps) {
  const { hasRole, hasPermission } = useAuth();
  const canRevert = hasPermission('setpoints:propose') || hasPermission('setpoints:approve');

  const isRevertFlow = request.status === 'REVERTED' || request.revertedAt;

  const timelineSteps = isRevertFlow ? REVERT_STATUS_ORDER : STATUS_ORDER;

  const getStepStatus = (step: SetpointRequest['status']): 'completed' | 'current' | 'pending' | 'failed' => {
    if (request.status === 'FAILED' || request.status === 'REJECTED') {
      const currentIndex = timelineSteps.indexOf(request.status);
      const stepIndex = timelineSteps.indexOf(step);
      if (stepIndex < currentIndex) return 'completed';
      if (stepIndex === currentIndex) return 'failed';
      return 'pending';
    }
    if (request.status === 'REVERTED') {
      const stepIndex = REVERT_STATUS_ORDER.indexOf(step);
      const currentIndex = REVERT_STATUS_ORDER.indexOf('REVERTED');
      if (stepIndex < currentIndex) return 'completed';
      if (stepIndex === currentIndex) return 'current';
      return 'pending';
    }
    const currentIndex = timelineSteps.indexOf(request.status);
    const stepIndex = timelineSteps.indexOf(step);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getApproverRoles = () => {
    const roles: Array<{ label: string; hasApproved: boolean }> = [
      { label: 'Facility Manager', hasApproved: request.approverRole === 'facility_manager' },
      { label: 'Admin', hasApproved: request.approverRole === 'admin' }
    ];
    return roles;
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
      <div className="absolute inset-0 bg-surface-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface-base border border-default rounded-xl shadow-xl overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default bg-surface-elevated">
          <div>
            <h2 id="request-detail-title" className="text-lg font-semibold text-content-primary">Set-point Request Detail</h2>
            <p className="text-sm text-content-tertiary">{request.asset} / {request.point}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[request.status])}>
              {STATUS_LABELS[request.status]}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-state-hover transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Values Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-surface-sunken border border-default">
              <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Current Value</p>
              <p className="font-mono tabular-nums text-xl font-medium text-content-primary">{request.currentValue}</p>
            </div>
            <div className="p-3 rounded-lg bg-surface-sunken border border-default flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-chilled)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className="p-3 rounded-lg bg-surface-sunken border border-default">
              <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Requested Value</p>
              <p className="font-mono tabular-nums text-xl font-medium text-chilled">{request.requestedValue}</p>
            </div>
          </div>

          {/* Safe Range */}
          {(request.safeMin !== undefined || request.safeMax !== undefined) && (
            <div className="p-3 rounded-lg bg-surface-sunken border border-default">
              <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Safe Operating Range</p>
              <div className="flex items-center gap-2 text-sm">
                {request.safeMin !== undefined && (
                  <span className="flex items-center gap-1 text-content-tertiary">
                    <span>Min:</span>
                    <span className="font-mono tabular-nums text-content-primary">{request.safeMin} {request.unit}</span>
                  </span>
                )}
                <span className="text-content-tertiary/50">→</span>
                {request.safeMax !== undefined && (
                  <span className="flex items-center gap-1 text-content-tertiary">
                    <span>Max:</span>
                    <span className="font-mono tabular-nums text-content-primary">{request.safeMax} {request.unit}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Justification */}
          <div className="p-3 rounded-lg bg-surface-sunken border border-default">
            <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Justification</p>
            <p className="text-content-primary">{request.justification}</p>
          </div>

          {/* Effective Window & Revert Time */}
          {(request.effectiveWindow || request.revertTime) && (
            <div className="grid gap-4 md:grid-cols-2">
              {request.effectiveWindow && (
                <div className="p-3 rounded-lg bg-surface-sunken border border-default">
                  <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Effective Window</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      <span className="text-content-tertiary">Start: </span>
                      <span className="font-mono tabular-nums text-content-primary">{formatTime(request.effectiveWindow.start)}</span>
                    </span>
                    <span className="flex-1">
                      <span className="text-content-tertiary">End: </span>
                      <span className="font-mono tabular-nums text-content-primary">{formatTime(request.effectiveWindow.end)}</span>
                    </span>
                  </div>
                </div>
              )}
              {request.revertTime && (
                <div className="p-3 rounded-lg bg-surface-sunken border border-default">
                  <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Auto Revert</p>
                  <p className="font-mono tabular-nums text-content-primary">{formatTime(request.revertTime)}</p>
                </div>
              )}
            </div>
          )}

          {/* State Timeline */}
          <div>
            <h3 className="text-sm font-medium text-content-primary mb-3">State Timeline</h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border-default" aria-hidden="true" />

              {timelineSteps.map((step, index) => {
                const stepStatus = getStepStatus(step);
                const isLast = index === timelineSteps.length - 1;
                const showLine = !isLast;

                let stepTime = '';
                let stepUser = '';
                let stepDetails = '';

                switch (step) {
                  case 'DRAFT':
                  case 'PENDING':
                    stepTime = formatTime(request.requestedAt);
                    stepUser = request.requester;
                    stepDetails = `Proposed ${request.requestedValue} (${request.requesterRole})`;
                    break;
                  case 'APPROVED':
                    stepTime = formatTime(request.approvedAt);
                    stepUser = request.approver || '—';
                    stepDetails = `Approved by ${request.approverRole || '—'}`;
                    break;
                  case 'APPLYING':
                    stepTime = formatTime(request.appliedAt);
                    stepUser = 'System';
                    stepDetails = `Gateway write initiated (idempotency: ${request.idempotencyKey.slice(0, 8)}…)`;
                    break;
                  case 'APPLIED':
                    stepTime = formatTime(request.readbackAt || request.appliedAt);
                    stepUser = 'System';
                    if (request.readbackValue !== undefined) {
                      stepDetails = `Read-back: ${request.readbackValue} ${request.readbackMatch ? '✓ Match' : '✗ Mismatch'}`;
                    } else {
                      stepDetails = 'Applied successfully';
                    }
                    break;
                  case 'REVERTED':
                    stepTime = formatTime(request.revertReadbackAt || request.revertedAt);
                    stepUser = 'System';
                    if (request.revertReadbackValue !== undefined) {
                      stepDetails = `Revert read-back: ${request.revertReadbackValue} ${request.revertReadbackMatch ? '✓ Match' : '✗ Mismatch'}`;
                    } else {
                      stepDetails = 'Reverted successfully';
                    }
                    break;
                  case 'FAILED':
                  case 'REJECTED':
                    stepTime = formatTime(request.approvedAt || request.appliedAt);
                    stepUser = request.approver || 'System';
                    stepDetails = request.status === 'FAILED' ? 'Gateway write failed or read-back mismatch' : 'Rejected by approver';
                    break;
                }

                return (
                  <div key={step} className="relative pl-14 pb-8 last:pb-0">
                    {/* Timeline dot */}
                    <div className={clsx(
                      'absolute left-6 w-3 h-3 rounded-full border-2 flex-shrink-0',
                      stepStatus === 'completed' ? 'bg-success border-success' :
                      stepStatus === 'current' ? 'bg-chilled border-chilled animate-pulse' :
                      stepStatus === 'failed' ? 'bg-critical border-critical' :
                      'bg-surface-base border-default'
                    )} aria-hidden="true" />

                    {/* Connecting line for completed steps */}
                    {showLine && (
                      <div className={clsx(
                        'absolute left-[7px] top-3 bottom-0 w-0.5',
                        stepStatus === 'completed' ? 'bg-success' : 'bg-border-default'
                      )} aria-hidden="true" />
                    )}

                    {/* Step content */}
                    <div className="ml-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-content-primary">{STATUS_LABELS[step]}</span>
                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                              stepStatus === 'completed' ? 'bg-success/10 text-success' :
                              stepStatus === 'current' ? 'bg-chilled/10 text-chilled' :
                              stepStatus === 'failed' ? 'bg-critical/10 text-critical' :
                              'bg-surface-sunken text-content-tertiary'
                            )}>
                              {stepStatus === 'completed' ? 'Done' : stepStatus === 'current' ? 'In Progress' : stepStatus === 'failed' ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                          {stepTime !== '—' && (
                            <p className="text-xs text-content-tertiary mt-0.5 font-mono tabular-nums">{stepTime}</p>
                          )}
                          {stepDetails && (
                            <p className="text-sm text-content-secondary mt-1">{stepDetails}</p>
                          )}
                          {stepUser && stepUser !== 'System' && (
                            <p className="text-xs text-content-tertiary mt-0.5">By: <span className="text-content-secondary">{stepUser}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Read-back Result Highlight */}
              {(request.status === 'APPLIED' || request.status === 'FAILED' || request.status === 'REVERTED') && (
                <div className={clsx('mt-4 p-4 rounded-lg border', request.readbackMatch === false || request.revertReadbackMatch === false ? 'bg-critical/5 border-critical/20' : 'bg-success/5 border-success/20')}>
                  <h4 className="font-medium text-content-primary mb-2">Read-back Verification</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-content-tertiary">Expected</p>
                      <p className="font-mono tabular-nums text-content-primary">{request.requestedValue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-tertiary">Actual (Read-back)</p>
                      <p className={clsx('font-mono tabular-nums', request.readbackMatch === false ? 'text-critical' : 'text-success')}>
                        {request.readbackValue || request.revertReadbackValue || '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                        request.readbackMatch === false || request.revertReadbackMatch === false ? 'bg-critical/10 text-critical' : 'bg-success/10 text-success'
                      )}>
                        {request.readbackMatch === false || request.revertReadbackMatch === false ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Mismatch — Auto-revert triggered
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                            Match confirmed
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer text-sm text-content-secondary">
              <span>Request Metadata</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="mt-3 p-3 rounded-lg bg-surface-sunken border border-default space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-content-tertiary">Request ID</span><span className="font-mono tabular-nums text-content-primary">{request.id}</span></div>
              <div className="flex justify-between"><span className="text-content-tertiary">Idempotency Key</span><span className="font-mono tabular-nums text-content-primary">{request.idempotencyKey}</span></div>
              <div className="flex justify-between"><span className="text-content-tertiary">Requested By</span><span className="text-content-secondary">{request.requester} ({request.requesterRole})</span></div>
              {request.approver && <div className="flex justify-between"><span className="text-content-tertiary">Approved By</span><span className="text-content-secondary">{request.approver} ({request.approverRole || '—'})</span></div>}
            </div>
          </details>

          {/* Actions */}
          {(request.status === 'APPLIED' && canRevert) && (
            <div className="pt-4 border-t border-default">
              <button className="w-full px-4 py-2 bg-critical/10 text-critical border border-critical/20 rounded-md text-sm font-medium hover:bg-critical/20 transition-colors">
                Revert to Previous Value
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}