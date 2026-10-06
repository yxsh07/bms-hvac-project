// Development fixture: placeholder equipment icons (PLAN §2.5 excludes fixtures
// from the site-agnostic gate). The production twin renders equipment from the
// twin-core GlyphRegistry by semantic role; this map is a scaffold for the shell.
import React from 'react';

export function getAssetTypeIcon(type: string, opts: { filled?: boolean; size?: number } = {}): React.ReactNode {
  const { filled = false, size = 16 } = opts;
  const chilled = filled ? 'var(--color-semantic-chilled)' : 'none';
  const chilledStroke = filled ? 'white' : 'var(--color-semantic-chilled)';
  const condenser = filled ? 'var(--color-semantic-condenser)' : 'none';
  const condenserStroke = filled ? 'white' : 'var(--color-semantic-condenser)';
  const neutral = filled ? 'var(--color-content-tertiary)' : 'none';
  const neutralStroke = filled ? 'white' : 'var(--color-content-tertiary)';

  const icons: Record<string, React.ReactNode> = {
    chiller: <svg width={size} height={size} viewBox="0 0 24 24" fill={chilled} stroke={chilledStroke} strokeWidth="2"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6v14M15 6v14" /></svg>,
    ahu: <svg width={size} height={size} viewBox="0 0 24 24" fill={chilled} stroke={chilledStroke} strokeWidth="2"><path d="M4 12h16M4 8h16M4 16h16" /><path d="M12 4v8" /></svg>,
    fcu: <svg width={size} height={size} viewBox="0 0 24 24" fill={chilled} stroke={chilledStroke} strokeWidth="2"><rect x="4" y="8" width="16" height="10" rx="1" /><path d="M8 8v10M16 8v10" /></svg>,
    pump: <svg width={size} height={size} viewBox="0 0 24 24" fill={condenser} stroke={condenserStroke} strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" /></svg>,
    coolingTower: <svg width={size} height={size} viewBox="0 0 24 24" fill={condenser} stroke={condenserStroke} strokeWidth="2"><path d="M6 20h16L18 4h-12z" /><path d="M8 16h8M10 12h4" /></svg>,
    default: <svg width={size} height={size} viewBox="0 0 24 24" fill={neutral} stroke={neutralStroke} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
  };
  return icons[type] || icons.default;
}
