/**
 * RRB Group D — Exam Pattern Config
 * exam_id   : RRB-GROUP-D-{YEAR}
 * pattern_id: RRB-GRP-D-PAT-V3
 *
 * Source: memory/exams/rrb/group-d.md
 * Duration: 90 min | Total: 100Q / 100 marks | Neg: -1/3
 *
 * VOLATILE: This file is config, not code.
 * Pattern change = update this file only. Zero deploy required for config changes
 * served from KV. This file is the source-of-truth template.
 */

export const MODULE_ID      = 'rrb-group-d'
export const MODULE_VERSION = 'v1.0.0'
export const TSF_VERSION    = '1.0.0'

// ─── Exam Pattern ────────────────────────────────────────────────────────────

export const EXAM_PATTERN = {
  exam_id    : 'RRB-GROUP-D-{YEAR}',
  pattern_id : 'RRB-GRP-D-PAT-V3',
  board_id   : 'RRB',

  header: {
    board     : 'RRB',
    exam_name : { en: 'Railway Recruitment Board', hi: 'रेलवे भर्ती बोर्ड' },
    post_name : { en: 'Computer Based Test (CBT) — Group D', hi: 'कम्प्यूटर आधारित परीक्षा — ग्रुप डी' },
  },

  schedule: {
    duration_sec : 5400,   // 90 minutes
    grace_sec    : 60,     // 60s buffer after timer ends before force-submit
  },

  // ─── Exam Runtime Config ─────────────────────────────────────────────────
  config: {
    lang           : ['en', 'hi'],  // bilingual — both always shown
    default_lang   : 'hi',          // hindi highlighted by default
    calculator     : false,         // no calculator in RRB Group D
    rough_sheet    : true,
    section_nav    : 'free',        // can jump between sections freely
    q_nav          : 'free',        // can jump to any question
    auto_save      : true,          // save on every option click
    fullscreen     : true,
    watermark      : true,          // "Mock Question" diagonal watermark
    tab_switch_limit : 3,           // warn at 1, auto-submit at 3
    copy_paste     : false,         // disabled in question panel
    right_click    : false,
  },

  // ─── Marking ─────────────────────────────────────────────────────────────
  marking: {
    default: {
      correct     : 1,
      wrong       : 0.33,   // -1/3 negative marking
      unattempted : 0,
    },
  },

  // ─── Sections ────────────────────────────────────────────────────────────
  sections: [
    {
      sid     : 'S1',
      label   : { en: 'Mathematics', hi: 'गणित' },
      subject : 'MATH',
      q_count : 25,
      q_from  : 1,
      q_to    : 25,
      time_sec: null,   // no sectional time limit
      color   : '#1565C0',
    },
    {
      sid     : 'S2',
      label   : { en: 'General Intelligence & Reasoning', hi: 'सामान्य बुद्धि एवं तर्कशक्ति' },
      subject : 'REAS',
      q_count : 30,
      q_from  : 26,
      q_to    : 55,
      time_sec: null,
      color   : '#2E7D32',
    },
    {
      sid     : 'S3',
      label   : { en: 'General Science', hi: 'सामान्य विज्ञान' },
      subject : 'SCI',
      q_count : 25,
      q_from  : 56,
      q_to    : 80,
      time_sec: null,
      color   : '#6A1B9A',
    },
    {
      sid     : 'S4',
      label   : { en: 'General Awareness & Current Affairs', hi: 'सामान्य जागरूकता और करेंट अफेयर्स' },
      subject : 'GK',
      q_count : 20,
      q_from  : 81,
      q_to    : 100,
      time_sec: null,
      color   : '#BF360C',
    },
  ],

  totals: {
    q_count    : 100,
    max_marks  : 100,
    duration_min: 90,
  },
}

// ─── Question State Codes ─────────────────────────────────────────────────────
// Matches real RRB CBT palette colour coding
export const Q_STATE = {
  NOT_VISITED      : 'not_visited',      // gray   — never opened
  NOT_ANSWERED     : 'not_answered',     // red    — opened, no answer saved
  ANSWERED         : 'answered',         // green  — saved answer
  MARKED_REVIEW    : 'marked_review',    // purple — flagged, no answer
  ANSWERED_MARKED  : 'answered_marked',  // purple+tick — flagged, has answer
}

// ─── Test Status Codes ────────────────────────────────────────────────────────
export const TEST_STATUS = {
  NOT_STARTED : 'not_started',
  IN_PROGRESS : 'in_progress',
  PAUSED      : 'paused',        // offline only
  SUBMITTED   : 'submitted',
}

// ─── Event Priority Map ───────────────────────────────────────────────────────
// Links to EIS (Event Ingestion Service)
export const EVENT_PRIORITY = {
  TEST_START  : 'P1',
  TEST_SUBMIT : 'P0',   // highest — must never be lost
  ANS_SAVE    : 'P2',
  ANS_CLEAR   : 'P3',
  Q_FLAG      : 'P4',
  Q_OPEN      : 'P5',
  SEC_CHANGE  : 'P4',
  TAB_SWITCH  : 'P2',
}

// ─── Palette Legend (matches RRB CBT UI) ─────────────────────────────────────
export const PALETTE_LEGEND = [
  { state: Q_STATE.ANSWERED,        color: '#43A047', label: { en: 'Answered',                   hi: 'उत्तर दिया' } },
  { state: Q_STATE.NOT_ANSWERED,    color: '#E53935', label: { en: 'Not Answered',               hi: 'उत्तर नहीं दिया' } },
  { state: Q_STATE.NOT_VISITED,     color: '#9E9E9E', label: { en: 'Not Visited',                hi: 'नहीं देखा' } },
  { state: Q_STATE.MARKED_REVIEW,   color: '#8E24AA', label: { en: 'Marked for Review',          hi: 'समीक्षा के लिए चिह्नित' } },
  { state: Q_STATE.ANSWERED_MARKED, color: '#6A1B9A', label: { en: 'Answered & Marked for Review', hi: 'उत्तर दिया और समीक्षा के लिए चिह्नित' } },
]
