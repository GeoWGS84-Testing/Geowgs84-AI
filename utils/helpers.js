// utils/helpers.js
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { expect } from '@playwright/test'

// Constants
export const PAUSE_MULTIPLIER = Number(process.env.PAUSE_MULTIPLIER || 0.55)
export const VISUAL_MIN_PAUSE = 25
export const DIAG_DIR = 'diagnostics'
export const VIDEO_DIR = path.join(process.cwd(), 'test-results')
export const SOFT_ASSERT = (process.env.SOFT_ASSERT || 'false').toLowerCase() === 'true'
export const DEFAULT_WAIT = Number(process.env.DEFAULT_WAIT || 15000)

// Track current test file name for artifact naming
let CURRENT_TEST_FILE = ''

// Ensure directories exist
;(function ensureDirExists() {
  [DIAG_DIR, VIDEO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })
})()

// State
let CURRENT_TESTCASE = ''
let CURRENT_FLOW = ''
const INFOS = []
const WARNINGS = []
const ERRORS = [] 
const ARTIFACTS = [] 

let lastErrorCount = 0
let lastWarningCount = 0

/* ===============================
   Context & Logging
================================ */
export function setContext({ testcase, flow, testFile } = {}) {
  if (testcase !== undefined) CURRENT_TESTCASE = testcase;
  if (flow !== undefined) CURRENT_FLOW = flow;
  if (testFile !== undefined) CURRENT_TEST_FILE = testFile;
  logInfo(`Context set`, { testcase: CURRENT_TESTCASE, flow: CURRENT_FLOW, testFile: CURRENT_TEST_FILE });
}

export function clearContext() {
  CURRENT_TESTCASE = ''
  CURRENT_FLOW = ''
  CURRENT_TEST_FILE = ''
}

export function getArtifacts() { return [...ARTIFACTS] }
export function clearArtifacts() { ARTIFACTS.length = 0 }

function _timestamp() { return new Date().toISOString() }

export function logInfo(message, meta = {}) {
  const entry = { ts: _timestamp(), level: 'info', message, meta }
  INFOS.push(entry)
  console.log(`[INFO] ${entry.ts} - ${message}`, meta)
}

export function addWarning(message, meta = {}) {
  const entry = { ts: _timestamp(), level: 'warn', message, meta }
  WARNINGS.push(entry)
  console.warn(`[WARN] ${entry.ts} - ${message}`, meta)
}

export function addError(message, meta = {}) {
  const entry = { ts: _timestamp(), level: 'error', message, meta }
  ERRORS.push(entry)
  console.error(`[ERROR] ${entry.ts} - ${message}`, meta)
}

/* ===============================
   Priority helper
================================ */
export function shouldRunPriority(priority) {
  const allowed = process.env.RUN_PRIORITIES;
  if (!allowed) return true;
  const list = allowed.split(',').map(p => p.trim().toUpperCase());
  return list.includes(priority.toUpperCase());
}

/* ===============================
   Diagnostics accessors
================================ */
export function getDiagnostics() {
  return {
    infos: [...INFOS],
    warnings: [...WARNINGS],
    errors: [...ERRORS],
    testcase: CURRENT_TESTCASE,
    flow: CURRENT_FLOW,
    testFile: CURRENT_TEST_FILE
  }
}

export async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function clearDiagnostics() {
  INFOS.length = 0
  WARNINGS.length = 0
  ERRORS.length = 0
  lastErrorCount = 0
  lastWarningCount = 0
}

export function clearDiagnosticsFolder() {
  if (fs.existsSync(DIAG_DIR)) {
    try {
      const files = fs.readdirSync(DIAG_DIR)
      for (const file of files) {
        const filePath = path.join(DIAG_DIR, file)
        if (fs.lstatSync(filePath).isDirectory()) {
           fs.rmSync(filePath, { recursive: true, force: true })
        } else {
           fs.unlinkSync(filePath)
        }
      }
      logInfo('Diagnostics folder cleared')
    } catch (err) {
      console.error('Failed to clear diagnostics folder', err)
    }
  }
}

/* ===============================
   Artifact Naming Strategy
================================ */
export function getTestFileName() {
  return CURRENT_TEST_FILE;
}

/**
 * Clean string for filename use
 */
function cleanForFilename(str) {
  if (!str) return '';
  return str
    .replace(/[\[\]]/g, '')           // Remove brackets
    .replace(/[:\/\\|?*]/g, '_')      // Replace invalid chars
    .replace(/\s+/g, '_')              // Spaces to underscores
    .replace(/_+/g, '_')               // Multiple underscores to single
    .replace(/^_|_$/g, '')             // Remove leading/trailing underscores
    .substring(0, 50);                 // Limit length
}

/**
 * Format artifact filename: Filename_TestTitle_Reason.ext
 */
export function formatArtifactFilename(testFile, testTitle, reason, ext) {
  const baseFileName = testFile ? path.basename(testFile, path.extname(testFile)) : 'test';
  const cleanTitle = cleanForFilename(testTitle);
  const cleanReason = cleanForFilename(reason) || 'FAILED';
  
  return `${baseFileName}_${cleanTitle}_${cleanReason}.${ext}`;
}

/**
 * Extract short reason from error message - keep it SHORT
 */
export function extractErrorReason(error) {
  if (!error) return 'FAILED';
  
  const msg = error.message || String(error);
  
  // Check for specific error types
  if (msg.includes('TimeoutError') || msg.toLowerCase().includes('timeout')) return 'TIMEOUT';
  if (msg.includes('AssertionError')) return 'ASSERTION_FAIL';
  if (msg.includes('not visible') || msg.includes('not found')) return 'ELEMENT_NOT_FOUND';
  if (msg.includes('selector')) return 'SELECTOR_ERROR';
  if (msg.includes('stale')) return 'STALE_ELEMENT';
  if (msg.includes('count') && (msg.includes('mismatch') || msg.includes('found'))) return 'COUNT_MISMATCH';
  if (msg.includes('navigate')) return 'NAVIGATION_ERROR';
  
  return 'FAILED';
}

/* ===============================
   Assertion & Interaction Helpers
================================ */
export async function waitForVisible(locator, timeout = DEFAULT_WAIT) {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch (err) {
    addWarning('waitForVisible timed out', { locator: locator?.toString?.() || String(locator), timeout, error: err.message, testcase: CURRENT_TESTCASE })
    return false
  }
}

export async function assertVisible(locator, label) {
  try {
    await expect(locator).toBeVisible({ timeout: DEFAULT_WAIT })
    return true
  } catch (err) {
    const meta = { label, error: err.message, testcase: CURRENT_TESTCASE }
    if (SOFT_ASSERT) {
      addWarning(`Soft-assert failed: ${label}`, meta)
      return false
    }
    addError(`Assertion failed: ${label}`, meta)
    throw err
  }
}

export async function robustClick(page, locator, opts = {}) {
  const { timeout = DEFAULT_WAIT, highlightBorder, retry = 1 } = opts
  try {
    const visible = await waitForVisible(locator, timeout)
    if (!visible) throw new Error('Element not visible to click')

    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 5000 })
      await locator.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }))
    } catch (e) { }

    try {
      await highlight(page, locator, { borderColor: highlightBorder, pause: 200 })
    } catch (e) { }

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        await locator.click({ timeout: 5000, force: false })
        logInfo('robustClick succeeded', { attempt, testcase: CURRENT_TESTCASE })
        return true
      } catch (err) {
        addWarning('robustClick attempt failed', { attempt, error: err.message })
        if (attempt === retry) {
            try {
                await locator.click({ force: true })
                logInfo('robustClick succeeded with force: true', { testcase: CURRENT_TESTCASE })
                return true
            } catch (finalErr) {
                throw finalErr
            }
        }
        await new Promise(r => setTimeout(r, 250))
      }
    }
  } catch (err) {
    addError('robustClick failed', { error: err.message, testcase: CURRENT_TESTCASE })
    throw err
  }
}

export async function waitAndFill(page, locator, value, opts = {}) {
  const { timeout = DEFAULT_WAIT, highlightBorder } = opts
  try {
    const visible = await waitForVisible(locator, timeout)
    if (!visible) throw new Error('Element not visible to fill')
    try {
      await highlight(page, locator, { borderColor: highlightBorder, pause: 200 })
    } catch (e) { }
    await locator.fill(value, { timeout: 5000 })
    logInfo('Filled input', { value: typeof value === 'string' ? `${value.slice(0, 20)}${value.length > 20 ? '...' : ''}` : typeof value, testcase: CURRENT_TESTCASE })
    return true
  } catch (err) {
    addError('waitAndFill failed', { error: err.message, testcase: CURRENT_TESTCASE })
    throw err
  }
}

/* ===============================
   Visual Helpers
================================ */
export async function fastWait(page, ms = 300) {
  const t = Math.max(VISUAL_MIN_PAUSE, Math.round(ms * PAUSE_MULTIPLIER))
  return page.waitForTimeout(t)
}

function _getRandomRGBA(alpha = 1) {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export async function highlight(page, locator, options = {}) {
  const { pause = 800, forceOutlineOnly = false } = options
  const bgColor = options.color || _getRandomRGBA(0.3);
  const effectiveBorder = options.borderColor || _getRandomRGBA(1);

  try {
    const handle = await locator.elementHandle()
    if (!handle) return
    await page.evaluate(({ el, border, bg, forceOutlineOnly }) => {
      el.style.outline = `3px solid ${border}`
      el.style.outlineOffset = '3px'
      if (bg) el.style.backgroundColor = bg
      if (!forceOutlineOnly) {
        el.scrollIntoView({ block: 'center', inline: 'center' })
      }
    }, { el: handle, border: effectiveBorder, bg: bgColor, forceOutlineOnly })
    await page.waitForTimeout(pause)
  } catch (err) { }
}

export async function showStep(page, text) {
  logInfo(`${text}`, { testcase: CURRENT_TESTCASE })

  const currentErrorCount = ERRORS.length;
  const currentWarningCount = WARNINGS.length;
  const hasNewErrors = currentErrorCount > lastErrorCount;
  const hasNewWarnings = currentWarningCount > lastWarningCount;
  
  lastErrorCount = currentErrorCount;
  lastWarningCount = currentWarningCount;

  // CAPTURE IMMEDIATELY ON ERROR/WARNING - SHOW MESSAGE FIRST
  if (hasNewErrors || hasNewWarnings) {
    try {
      if (!page.isClosed()) {
        const msgType = hasNewErrors ? 'ERROR' : 'WARNING';
        const msgText = hasNewErrors 
          ? (ERRORS[ERRORS.length - 1]?.message || 'Error occurred') 
          : (WARNINGS[WARNINGS.length - 1]?.message || 'Warning occurred');
        
        // SHOW MESSAGE ON SCREEN FIRST - use small banner
        await showTestFailure(page, msgText, msgType);
        await fastWait(page, 2000); // Let user see the message

        // THEN capture screenshot
        const reason = hasNewErrors ? 'ERROR_DETECTED' : 'WARNING_DETECTED';
        const filePath = await captureScreenshot(page, CURRENT_TESTCASE, reason);
        if (filePath) ARTIFACTS.push(filePath);
      }
    } catch (e) { console.warn('Failed immediate capture:', e.message); }
  }

  // Standard Step Banner
  try {
    if (!page.isClosed()) {
      await page.evaluate(({ stepText, testCase }) => {
        let spacer = document.getElementById('pw-layout-spacer')
        if (!spacer) {
          spacer = document.createElement('div')
          spacer.id = 'pw-layout-spacer'
          spacer.style.width = '100%'; spacer.style.pointerEvents = 'none'
          document.body.prepend(spacer)
        }
        let bar = document.getElementById('pw-banner-container')
        if (!bar) {
          bar = document.createElement('div')
          bar.id = 'pw-banner-container'
          Object.assign(bar.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '99999',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '6px 12px', boxSizing: 'border-box', pointerEvents: 'none',
            fontFamily: 'Segoe UI, sans-serif',
            background: 'linear-gradient(90deg, rgba(115,102,255,0.85), rgba(58,199,147,0.85))',
            borderBottom: '2px solid rgba(255,255,255,0.12)'
          })
          const tc = document.createElement('div')
          tc.id = 'pw-testcase-header'
          Object.assign(tc.style, { padding: '6px 12px', fontSize: '14px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' })
          const step = document.createElement('div')
          step.id = 'pw-step-banner'
          Object.assign(step.style, { padding: '6px 10px', fontSize: '13px', fontWeight: '600', color: 'rgba(10,10,30,0.95)', background: 'rgba(255,255,255,0.9)', borderRadius: '6px', minWidth: '160px', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
          bar.appendChild(tc); bar.appendChild(step)
          document.body.appendChild(bar)
        }
        const tcEl = document.getElementById('pw-testcase-header')
        const stepEl = document.getElementById('pw-step-banner')
        if (testCase) { tcEl.textContent = `TEST CASE : ${testCase}`; tcEl.style.display = 'block' } else { tcEl.style.display = 'none' }
        stepEl.textContent = stepText
        spacer.style.height = `${bar.offsetHeight}px`
      }, { stepText: text, testCase: CURRENT_TESTCASE })
    }
  } catch (err) { }
  await fastWait(page, 300)
}

/**
 * Show failure/error message on screen - CALL THIS BEFORE CAPTURING
 * @param {Page} page - Playwright page
 * @param {string} message - Error message to show
 * @param {string} type - 'ERROR', 'WARNING', or 'FAILURE'
 * @param {number} waitMs - How long to show the message before returning
 */
export async function showFailureMessage(page, message, type = 'FAILURE', waitMs = 5000) {
  const colors = {
    'FAILURE': { bg: 'rgba(180, 0, 0, 0.95)', border: '#ff0000' },
    'ERROR': { bg: 'rgba(200, 50, 50, 0.95)', border: '#ff4444' },
    'WARNING': { bg: 'rgba(200, 150, 0, 0.95)', border: '#ffaa00' }
  };
  const color = colors[type] || colors['FAILURE'];
  
  const displayMsg = message.length > 300 ? message.substring(0, 300) + '...' : message;
  
  console.error(`\n${'='.repeat(70)}`);
  console.error(`[${type}] ${displayMsg}`);
  console.error(`${'='.repeat(70)}\n`);
  
  try {
    if (!page.isClosed()) {
      await page.evaluate(({ msg, type, bgColor, borderColor }) => {
        // Remove any existing banner
        const existing = document.getElementById('pw-fatal-failure-banner');
        if (existing) existing.remove();
        
        const banner = document.createElement('div');
        banner.id = 'pw-fatal-failure-banner';
        Object.assign(banner.style, {
          position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', 
          zIndex: '9999999', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: bgColor, color: '#ffffff', fontFamily: 'Segoe UI, sans-serif', 
          fontSize: '16px', fontWeight: 'bold', padding: '30px', boxSizing: 'border-box', 
          textAlign: 'center'
        });
        
        const title = document.createElement('div');
        title.innerText = type === 'FAILURE' ? '❌ TEST FAILED' : type === 'ERROR' ? '⚠️ ERROR DETECTED' : '⚠️ WARNING';
        title.style.fontSize = '32px';
        title.style.marginBottom = '20px';
        title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        
        const details = document.createElement('div');
        details.innerText = msg;
        details.style.fontSize = '14px'; 
        details.style.fontWeight = 'normal';
        details.style.maxWidth = '80%';
        details.style.lineHeight = '1.6';
        details.style.background = 'rgba(0,0,0,0.3)';
        details.style.padding = '20px';
        details.style.borderRadius = '10px';
        details.style.border = `2px solid ${borderColor}`;
        
        const info = document.createElement('div');
        info.innerText = '📸 Capturing screenshot and video...';
        info.style.fontSize = '12px';
        info.style.marginTop = '20px';
        info.style.opacity = '0.8';
        
        banner.appendChild(title);
        banner.appendChild(details);
        banner.appendChild(info);
        document.body.appendChild(banner);
      }, { msg: displayMsg, type, bgColor: color.bg, borderColor: color.border });
      
      if (waitMs > 0) {
        await fastWait(page, waitMs);
      }
    }
  } catch (err) { 
    console.warn('Could not show failure message on screen:', err.message); 
  }
}

/**
 * Show small failure banner (not full screen) - can be called from tests
 * This is the preferred method for showing failures in page objects
 */
export async function showTestFailure(page, message, type = 'FAILURE') {
  const colors = {
    'FAILURE': { bg: '#dc3545', icon: '❌' },
    'ERROR': { bg: '#dc3545', icon: '⚠️' },
    'WARNING': { bg: '#ffc107', icon: '⚠️' }
  };
  const color = colors[type] || colors['FAILURE'];
  const displayMsg = message.length > 150 ? message.substring(0, 150) + '...' : message;
  
  console.error(`\n[${type}] ${displayMsg}\n`);
  
  try {
    if (!page.isClosed()) {
      await page.evaluate(({ msg, bgColor, icon }) => {
        const existing = document.getElementById('pw-failure-banner');
        if (existing) existing.remove();
        
        const banner = document.createElement('div');
        banner.id = 'pw-failure-banner';
        banner.style.cssText = `
          position: fixed; top: 50px; left: 50%; transform: translateX(-50%);
          z-index: 9999999; max-width: 600px; width: 90%;
          background: ${bgColor}; color: white;
          padding: 12px 20px; border-radius: 8px;
          font-family: 'Segoe UI', sans-serif; font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; gap: 10px;
        `;
        
        const iconEl = document.createElement('span');
        iconEl.textContent = icon;
        iconEl.style.fontSize = '20px';
        
        const textEl = document.createElement('span');
        textEl.textContent = msg;
        textEl.style.flex = '1';
        
        banner.appendChild(iconEl);
        banner.appendChild(textEl);
        document.body.appendChild(banner);
      }, { msg: displayMsg, bgColor: color.bg, icon: color.icon });
      
      await fastWait(page, 3000);
    }
  } catch (err) { 
    console.warn('Could not show failure banner:', err.message); 
  }
}

/**
 * Show full failure with stack trace and WAIT before closing
 */
export async function showFailure(page, error) {
  const message = error?.message || String(error);
  const stack = error?.stack || '';
  
  // Log full failure details
  console.error(`\n${'='.repeat(70)}`);
  console.error(`[FAILURE] TEST FAILED`);
  console.error(`${'='.repeat(70)}`);
  console.error(`Message: ${message}`);
  if (stack) {
    console.error(`\nStack Trace:`);
    console.error(stack);
  }
  console.error(`${'='.repeat(70)}\n`);
  
  // Show on screen with longer wait
  await showFailureMessage(page, message, 'FAILURE', 5000);
}

/**
 * Capture screenshot with proper naming
 */
export async function captureScreenshot(page, testTitle, reason, testFile = null) {
  try {
    const dir = VIDEO_DIR; 
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const actualTestFile = testFile || CURRENT_TEST_FILE || 'test.spec.js';
    const filename = formatArtifactFilename(actualTestFile, testTitle, reason, 'png');
    const filePath = path.join(dir, filename);
    
    await page.screenshot({ path: filePath, fullPage: true })
    logInfo('Screenshot captured', { path: filePath, filename })
    return filePath
  } catch (err) {
    console.warn('captureScreenshot failed', err.message)
    return null
  }
}

async function _findFilesRecursively(dir) {
  const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
  let files = []
  for (const e of entries) {
    const res = path.join(dir, e.name)
    if (e.isDirectory()) {
      files = files.concat(await _findFilesRecursively(res))
    } else {
      files.push(res)
    }
  }
  return files
}

/**
 * Generate video filename with proper naming convention
 */
export function generateVideoFilename(testFile, testTitle, reason) {
  return formatArtifactFilename(testFile, testTitle, reason, 'webm');
}


/* ===============================
   Additional Helpers
================================ */
export async function safeExpectVisible(locator, label = '', timeout = 5000, shouldThrow = false) {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch (e) {
    const meta = { label, error: String(e), testcase: CURRENT_TESTCASE }
    if (shouldThrow) {
      addError(`safeExpectVisible failed: ${label}`, meta)
      throw new Error(`safeExpectVisible failed: ${label}`)
    } else {
      addWarning(`safeExpectVisible failed: ${label}`, meta)
    }
    return false
  }
}

export async function assertOrWarn(condition, message, critical = false, meta = {}) {
  if (condition) return true
  if (critical) {
    await addError(message, meta)
    throw new Error(message)
  } else {
    addWarning(message, meta)
  }
  return false
}

export async function annotateElementLabel(page, locator, label) {
  try {
    await highlight(page, locator, { pause: 400 })
    await page.evaluate(({ el, label }) => {
      try {
        const root = el
        const tag = document.createElement('div')
        tag.textContent = label
        Object.assign(tag.style, {
          position: 'absolute',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '11px',
          padding: '3px 6px',
          borderRadius: '4px',
          zIndex: 9999999,
          pointerEvents: 'none'
        })
        root.style.position = root.style.position || 'relative'
        root.appendChild(tag)
        setTimeout(() => tag.remove(), 2500)
      } catch (e) {}
    }, { el: await locator.elementHandle(), label })
  } catch (e) {
    addWarning('annotateElementLabel failed', { error: String(e) })
  }
}

export async function getInnerTextSafe(locator) {
  try {
    return (await locator.innerText()).trim();
  } catch (e) {
    try {
      const h = await locator.elementHandle();
      if (!h) return '';
      return (await h.evaluate(el => (el.textContent || '').trim())) || '';
    } catch {
      return '';
    }
  }
}

export async function getFirstValidOptionLabel(selectLocator) {
  const opts = await selectLocator.locator('option').all();
  for (const o of opts) {
    const txt = (await o.innerText()).trim();
    if (!txt) continue;
    const lower = txt.toLowerCase();
    if (lower.includes('select') || lower.includes('please') || lower.includes('upload new')) continue;
    return txt;
  }
  return null;
}

export function persistDiagnosticsSummary(extra = {}) {
  const summaryPath = `${DIAG_DIR}/summary.json`
  const summary = {
    timestamp: new Date().toISOString(),
    testcase: CURRENT_TESTCASE,
    testFile: CURRENT_TEST_FILE,
    infos: INFOS,
    warnings: WARNINGS,
    errors: ERRORS,
    extra
  }
  let data = []
  if (fs.existsSync(summaryPath)) {
    try {
      data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
      if (!Array.isArray(data)) data = []
    } catch (e) { data = [] }
  }
  data.push(summary)
  fs.writeFileSync(summaryPath, JSON.stringify(data, null, 2))
}

export default {
  setContext, clearContext, logInfo, addWarning, addError,
  persistDiagnosticsSummary, captureScreenshot, 
  getDiagnostics, clearDiagnostics, clearDiagnosticsFolder,
  shouldRunPriority, showStep, highlight, fastWait, assertVisible, robustClick, waitAndFill,
  showFailure, showFailureMessage, showTestFailure, sleep, getArtifacts, clearArtifacts,
  safeExpectVisible, assertOrWarn, annotateElementLabel, getInnerTextSafe, getFirstValidOptionLabel,
  getTestFileName, extractErrorReason, generateVideoFilename, formatArtifactFilename
}
