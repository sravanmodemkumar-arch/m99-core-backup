/**
 * RRB Group D — UI Theme
 * Matches the real RRB CBT interface exactly (as per screenshot reference)
 *
 * Real RRB CBT colors:
 *  Header bar      : #1A3A5C (dark navy blue)
 *  Sub header      : #2D5986 (medium blue)
 *  Section bar     : #F5F5F5 (light gray)
 *  Question area   : #FFFFFF (white)
 *  Right sidebar   : #F8F8F8
 *  Timer           : #CC0000 (red when < 5 min)
 */

export const THEME = {
  // ── Brand (overridden by tenant config at runtime) ────────────────────────
  brand: {
    name        : 'RRB Group D CBT',
    logo_url    : '/assets/rrb-logo.png',
    govt_logo   : '/assets/india-govt-logo.png',
    watermark   : 'Mock Question',
  },

  // ── Color Palette ─────────────────────────────────────────────────────────
  colors: {
    // Header
    header_bg        : '#1A3A5C',
    header_text      : '#FFFFFF',
    subheader_bg     : '#2D5986',
    subheader_text   : '#FFFFFF',

    // Section / Nav bar
    section_bar_bg   : '#E8EDF2',
    section_bar_text : '#1A3A5C',
    section_active   : '#1565C0',

    // Question panel
    question_bg      : '#FFFFFF',
    question_text    : '#212121',
    question_num_bg  : '#F5F5F5',

    // Options
    option_bg        : '#FFFFFF',
    option_hover     : '#E3F2FD',
    option_selected  : '#BBDEFB',
    option_border    : '#BDBDBD',

    // Timer
    timer_normal     : '#FFFFFF',
    timer_warning    : '#FF8F00',   // < 10 min
    timer_critical   : '#CC0000',   // < 5 min

    // Sidebar
    sidebar_bg       : '#F8F9FA',
    sidebar_border   : '#DEE2E6',

    // Watermark
    watermark_color  : 'rgba(180, 180, 180, 0.35)',
  },

  // ── Question Palette ──────────────────────────────────────────────────────
  palette: {
    not_visited     : { bg: '#9E9E9E', text: '#FFFFFF', border: '#757575' },
    not_answered    : { bg: '#E53935', text: '#FFFFFF', border: '#C62828' },
    answered        : { bg: '#43A047', text: '#FFFFFF', border: '#2E7D32' },
    marked_review   : { bg: '#8E24AA', text: '#FFFFFF', border: '#6A1B9A' },
    answered_marked : { bg: '#6A1B9A', text: '#FFFFFF', border: '#4A148C', tick: true },
    current         : { outline: '#F57F17', outline_width: '3px' },
  },

  // ── Bottom Action Bar ─────────────────────────────────────────────────────
  buttons: {
    mark_review: {
      label : { en: 'Mark for Review & Next', hi: 'समीक्षा हेतु चिह्नित करें और अगला' },
      bg    : '#8E24AA',
      text  : '#FFFFFF',
      hover : '#6A1B9A',
    },
    clear: {
      label : { en: 'Clear Response', hi: 'उत्तर हटाएं' },
      bg    : '#FFFFFF',
      text  : '#424242',
      border: '#BDBDBD',
      hover : '#F5F5F5',
    },
    save_next: {
      label : { en: 'Save & Next', hi: 'सहेजें और अगला' },
      bg    : '#1565C0',
      text  : '#FFFFFF',
      hover : '#0D47A1',
    },
    previous: {
      label : { en: 'Previous', hi: 'पिछला' },
      bg    : '#FFFFFF',
      text  : '#424242',
      border: '#BDBDBD',
      hover : '#F5F5F5',
    },
    submit: {
      label : { en: 'Submit', hi: 'जमा करें' },
      bg    : '#E53935',
      text  : '#FFFFFF',
      hover : '#C62828',
    },
  },

  // ── Typography ────────────────────────────────────────────────────────────
  fonts: {
    primary    : "'Noto Sans", "Noto Sans Devanagari", sans-serif',
    question   : '16px',
    option     : '15px',
    ui         : '14px',
    timer      : '20px',
    palette_num: '13px',
  },

  // ── Layout Dimensions ─────────────────────────────────────────────────────
  layout: {
    header_height    : '56px',
    section_bar_h    : '44px',
    sidebar_width    : '260px',
    bottom_bar_h     : '56px',
    palette_cols     : 5,       // 5 columns in question number grid
    palette_cell_size: '40px',
  },

  // ── Bilingual Display ─────────────────────────────────────────────────────
  // Both EN and HI always visible. Toggle highlights one.
  bilingual: {
    separator     : '•',
    en_active_color: '#1565C0',
    hi_active_color: '#1565C0',
    inactive_color : '#757575',
  },
}
