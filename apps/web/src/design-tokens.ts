// Design Tokens - Core token definitions
// Two themes: neutral (default, public-safe) and smartjoules (private)

export const tokens = {
  // Color primitives - Neutral theme (default, public-safe)
  neutral: {
    // Base surfaces
    surface: {
      base: '#FFFFFF',
      elevated: '#F8F9FA',
      sunken: '#F1F3F4',
      overlay: 'rgba(11, 58, 64, 0.6)'
    },
    // Content colors
    content: {
      primary: '#0B3A40',
      secondary: '#3A4A50',
      tertiary: '#6B7B80',
      inverse: '#FFFFFF',
      disabled: '#9AA8AD'
    },
    // Border colors
    border: {
      default: '#E0E4E6',
      strong: '#C5CDD0',
      focus: '#1F5FA8',
      error: '#C42B1C'
    },
    // Semantic colors - industry standard for HVAC
    semantic: {
      chilled: '#1F5FA8',      // Blue - chilled water
      condenser: '#E8702A',    // Orange - condenser/hot water
      success: '#2E9E5B',      // Green - OK/running
      warning: '#D4A01E',      // Amber - warning
      critical: '#C42B1C',     // Red - alarm/critical
      info: '#1F5FA8',         // Blue - info
      stale: '#9AA8AD',        // Grey - stale data
      missing: '#D0D5D8'       // Light grey - missing
    },
    // State colors
    state: {
      hover: 'rgba(11, 58, 64, 0.04)',
      active: 'rgba(11, 58, 64, 0.08)',
      selected: 'rgba(31, 95, 168, 0.12)',
      focusRing: '#1F5FA8'
    },
    // Chart colors
    chart: {
      grid: 'rgba(11, 58, 64, 0.08)',
      axis: '#6B7B80',
      tooltip: '#0B3A40',
      tooltipText: '#FFFFFF',
      series: ['#1F5FA8', '#E8702A', '#2E9E5B', '#D4A01E', '#C42B1C', '#6B7B80', '#0B3A40', '#3A4A50']
    },
    // Status pill backgrounds
    status: {
      running: '#E8F5ED',
      runningText: '#1A7A3D',
      stopped: '#FCE8E6',
      stoppedText: '#A82317',
      alarm: '#FEF3E2',
      alarmText: '#B85C0E',
      unknown: '#F1F3F4',
      unknownText: '#6B7B80'
    }
  },

  // Color primitives - SmartJoules theme (private, brand colors)
  smartjoules: {
    surface: {
      base: '#FFFFFF',
      elevated: '#F0F4F5',
      sunken: '#E8EEF0',
      overlay: 'rgba(11, 58, 64, 0.7)'
    },
    content: {
      primary: '#082A2E',
      secondary: '#2D4549',
      tertiary: '#5A7175',
      inverse: '#FFFFFF',
      disabled: '#8A9BA0'
    },
    border: {
      default: '#D0DCE0',
      strong: '#B0C0C5',
      focus: '#0066CC',
      error: '#B81E1E'
    },
    semantic: {
      chilled: '#0066CC',
      condenser: '#E05E00',
      success: '#1E8A49',
      warning: '#C89000',
      critical: '#B81E1E',
      info: '#0066CC',
      stale: '#8A9BA0',
      missing: '#C0CCD0'
    },
    state: {
      hover: 'rgba(8, 42, 46, 0.04)',
      active: 'rgba(8, 42, 46, 0.08)',
      selected: 'rgba(0, 102, 204, 0.12)',
      focusRing: '#0066CC'
    },
    chart: {
      grid: 'rgba(8, 42, 46, 0.08)',
      axis: '#5A7175',
      tooltip: '#082A2E',
      tooltipText: '#FFFFFF',
      series: ['#0066CC', '#E05E00', '#1E8A49', '#C89000', '#B81E1E', '#5A7175', '#082A2E', '#2D4549']
    },
    status: {
      running: '#E0F2E8',
      runningText: '#147034',
      stopped: '#FDE0DD',
      stoppedText: '#9C1E14',
      alarm: '#FEF0DB',
      alarmText: '#A8540A',
      unknown: '#E8EEF0',
      unknownText: '#5A7175'
    }
  },

  // Typography
  typography: {
    fontFamily: {
      // Using system fonts for performance and distinctiveness
      // Primary: Inter (geometric, technical feel) - loaded via Google Fonts
      // Fallback stack ensures consistent rendering
      sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Consolas', 'monospace']
    },
    fontSize: {
      xs: '0.7rem',      // 11.2px - small labels, badges
      sm: '0.8125rem',   // 13px - secondary text
      base: '0.9375rem', // 15px - body text
      lg: '1.0625rem',   // 17px - emphasized body
      xl: '1.25rem',     // 20px - small headings
      '2xl': '1.5rem',   // 24px - medium headings
      '3xl': '1.875rem', // 30px - large headings
      '4xl': '2.5rem',   // 40px - hero numbers
      '5xl': '3.5rem'    // 56px - display numbers
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.1,
      normal: 1.5,
      relaxed: 1.65
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
      wider: '0.08em' // for tabular numerals
    }
  },

  // Spacing scale (4px base)
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem'      // 96px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px - small elements
    md: '0.5rem',    // 8px - cards, inputs
    lg: '0.75rem',   // 12px - panels
    xl: '1rem',      // 16px - modals
    full: '9999px'   // pills, badges
  },

  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(11, 58, 64, 0.05)',
    md: '0 4px 8px rgba(11, 58, 64, 0.08)',
    lg: '0 8px 24px rgba(11, 58, 64, 0.1)',
    xl: '0 16px 48px rgba(11, 58, 64, 0.12)',
    inner: 'inset 0 2px 4px rgba(11, 58, 64, 0.05)'
  },

  // Transitions
  transitions: {
    fast: '120ms ease-out',
    normal: '200ms ease-out',
    slow: '300ms ease-out'
  },

  // Breakpoints
  breakpoints: {
    phone: '390px',
    tabletPortrait: '820px',
    tabletLandscape: '1180px',
    desktop: '1440px'
  },

  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    header: 300,
    modal: 400,
    popover: 500,
    tooltip: 600,
    toast: 700
  },

  // Layout dimensions
  layout: {
    headerHeight: '56px',
    headerHeightCompact: '48px',
    sidePanelWidth: '360px',
    sidePanelWidthNarrow: '300px',
    controlStripHeight: '72px',
    tabBarHeight: '44px',
    breadcrumbHeight: '36px'
  }
};

export type Tokens = typeof tokens;
export type ThemeName = 'neutral' | 'smartjoules';
export type ThemeTokens = typeof tokens.neutral;