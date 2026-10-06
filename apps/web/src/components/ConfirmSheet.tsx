import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import type { PointDefinition } from '../types/telemetry';

interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmData) => void;
  assetName: string;
  pointDisplayName: string;
  currentValue: string;
  pointDefinition: PointDefinition;
  unit: string;
  safeMin?: number;
  safeMax?: number;
}

interface ConfirmData {
  newValue: string;
  justification: string;
  effectiveWindow?: { start: string; end: string };
  revertTime?: string;
}

export function ConfirmSheet({
  isOpen,
  onClose,
  onConfirm,
  assetName,
  pointDisplayName,
  currentValue,
  pointDefinition,
  unit,
  safeMin,
  safeMax
}: ConfirmSheetProps) {
  const { hasPermission } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [newValue, setNewValue] = useState(() => currentValue.replace(/[^\d.-]/g, ''));
  const [justification, setJustification] = useState('');
  const [effectiveStart, setEffectiveStart] = useState('');
  const [effectiveEnd, setEffectiveEnd] = useState('');
  const [revertTime, setRevertTime] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Focus trap and escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the input
    setTimeout(() => {
      contentRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const canPropose = hasPermission('setpoints:propose');
  const canApprove = hasPermission('setpoints:approve');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newValue.trim()) {
      newErrors.newValue = 'Required';
    } else {
      const num = parseFloat(newValue);
      if (isNaN(num)) {
        newErrors.newValue = 'Must be a number';
      } else if (safeMin !== undefined && num < safeMin) {
        newErrors.newValue = `Below safe minimum (${safeMin} ${unit})`;
      } else if (safeMax !== undefined && num > safeMax) {
        newErrors.newValue = `Above safe maximum (${safeMax} ${unit})`;
      }
    }

    if (!justification.trim()) {
      newErrors.justification = 'Justification is required';
    } else if (justification.length < 10) {
      newErrors.justification = 'Justification must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    onConfirm({
      newValue: `${newValue}${unit ? ` ${unit}` : ''}`,
      justification,
      effectiveWindow: (effectiveStart && effectiveEnd) ? { start: effectiveStart, end: effectiveEnd } : undefined,
      revertTime: revertTime || undefined
    });
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  const portalContent = (
    <div className="confirm-sheet-overlay fixed inset-0 z-[600] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
      <div
        ref={overlayRef}
        className="confirm-sheet-overlay-bg absolute inset-0 bg-surface-overlay animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className="confirm-sheet-content relative w-full max-w-md bg-surface-base border border-default rounded-xl shadow-xl animate-slide-up overflow-hidden"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default bg-surface-elevated">
          <h2 id="confirm-sheet-title" className="text-lg font-semibold text-content-primary">Confirm Set-point Change</h2>
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Asset & Point Info */}
          <div className="bg-surface-sunken rounded-lg p-3 border border-default">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Asset</span>
              <span className="font-medium text-content-primary">{assetName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Point</span>
              <span className="text-content-primary">{pointDisplayName}</span>
            </div>
          </div>

          {/* Current Value */}
          <div>
            <label htmlFor="current-value" className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Current Value</label>
            <input
              id="current-value"
              type="text"
              value={currentValue}
              readOnly
              className="w-full px-3 py-2 bg-surface-sunken border border-default rounded-md text-content-primary font-mono tabular-nums"
            />
          </div>

          {/* New Value Input */}
          <div>
            <label htmlFor="new-value" className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">New Value <span className="text-critical">*</span></label>
            <div className="relative">
              <input
                id="new-value"
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={unit ? `Enter value in ${unit}` : 'Enter value'}
                className={clsx(
                  'w-full px-3 py-2 bg-surface-base border rounded-md text-content-primary font-mono tabular-nums',
                  errors.newValue ? 'border-error focus:border-error' : 'border-default focus:border-focus'
                )}
                disabled={!canPropose && !canApprove}
                aria-invalid={errors.newValue ? 'true' : 'false'}
                aria-describedby={errors.newValue ? 'new-value-error' : undefined}
              />
              {unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary font-mono text-sm">{unit}</span>
              )}
            </div>
            {errors.newValue && (
              <p id="new-value-error" className="mt-1 text-xs text-critical" role="alert">{errors.newValue}</p>
            )}
            {!canPropose && !canApprove && (
              <p className="mt-1 text-xs text-content-disabled">Your role does not have permission to propose set-point changes</p>
            )}
          </div>

          {/* Safe Range */}
          {(safeMin !== undefined || safeMax !== undefined) && (
            <div className="bg-surface-sunken rounded-lg p-3 border border-default">
              <div className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-2">Safe Operating Range</div>
              <div className="flex items-center gap-2 text-sm">
                {safeMin !== undefined && (
                  <span className="flex items-center gap-1 text-content-tertiary">
                    <span>Min:</span>
                    <span className="font-mono tabular-nums text-content-primary">{safeMin} {unit}</span>
                  </span>
                )}
                <span className="text-content-tertiary/50">→</span>
                {safeMax !== undefined && (
                  <span className="flex items-center gap-1 text-content-tertiary">
                    <span>Max:</span>
                    <span className="font-mono tabular-nums text-content-primary">{safeMax} {unit}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Justification */}
          <div>
            <label htmlFor="justification" className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Justification <span className="text-critical">*</span></label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this change is needed..."
              rows={3}
              className={clsx(
                'w-full px-3 py-2 bg-surface-base border rounded-md text-content-primary resize-none',
                errors.justification ? 'border-error focus:border-error' : 'border-default focus:border-focus'
              )}
              disabled={!canPropose && !canApprove}
              aria-invalid={errors.justification ? 'true' : 'false'}
              aria-describedby={errors.justification ? 'justification-error' : undefined}
            />
            {errors.justification && (
              <p id="justification-error" className="mt-1 text-xs text-critical" role="alert">{errors.justification}</p>
            )}
          </div>

          {/* Optional: Effective Window */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer text-sm text-content-secondary">
              <span>Effective Window (optional)</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="mt-3 space-y-3 pt-3 border-t border-default">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="effective-start" className="block text-xs font-medium text-content-secondary mb-1">Start</label>
                  <input
                    id="effective-start"
                    type="datetime-local"
                    value={effectiveStart}
                    onChange={(e) => setEffectiveStart(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-default rounded-md text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                  />
                </div>
                <div>
                  <label htmlFor="effective-end" className="block text-xs font-medium text-content-secondary mb-1">End</label>
                  <input
                    id="effective-end"
                    type="datetime-local"
                    value={effectiveEnd}
                    onChange={(e) => setEffectiveEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-default rounded-md text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Optional: Revert Time */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer text-sm text-content-secondary">
              <span>Auto Revert (optional)</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="mt-3 pt-3 border-t border-default">
              <label htmlFor="revert-time" className="block text-xs font-medium text-content-secondary mb-1">Revert At</label>
              <input
                id="revert-time"
                type="datetime-local"
                value={revertTime}
                onChange={(e) => setRevertTime(e.target.value)}
                className="w-full px-3 py-2 bg-surface-base border border-default rounded-md text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
              <p className="mt-1 text-xs text-content-tertiary">Automatically revert to the previous value at this time</p>
            </div>
          </details>

          {/* Roles that can approve */}
          <div className="bg-surface-sunken rounded-lg p-3 border border-default">
            <div className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-2">Approvers Required</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-chilled/10 text-chilled">Facility Manager</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-chilled/10 text-chilled">Admin</span>
            </div>
            <p className="mt-2 text-xs text-content-tertiary">No self-approval — even for administrators</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-sunken text-content-primary text-sm rounded-md border border-default hover:bg-state-hover transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={clsx(
                'px-4 py-2 text-white text-sm rounded-md transition-colors font-medium',
                (canPropose || canApprove) ? 'bg-chilled hover:opacity-90' : 'bg-content-disabled cursor-not-allowed'
              )}
              disabled={!canPropose && !canApprove || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : canPropose ? 'Propose Change' : 'Request Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}