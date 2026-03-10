// tests/common.js
import { test as base } from '@playwright/test'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import {
  setContext, clearContext, clearDiagnostics, getArtifacts, clearArtifacts,
  showTestFailure, extractErrorReason, formatArtifactFilename, logInfo, addWarning, addError
} from '../utils/helpers'

export const VIDEO_DIR = path.join(process.cwd(), 'test-results')

/**
 * Find Playwright's auto-generated test folder
 * Playwright creates folders like: test-results/testname-browser/
 */
async function findPlaywrightTestFolder(testTitle) {
  try {
    if (!fs.existsSync(VIDEO_DIR)) return null;
    
    const entries = await fsPromises.readdir(VIDEO_DIR, { withFileTypes: true });
    
    // Clean test title for matching
    const cleanTitle = testTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    
    // Find matching folder (most recent if multiple)
    const matchingFolders = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name: e.name,
        path: path.join(VIDEO_DIR, e.name),
        time: fs.statSync(path.join(VIDEO_DIR, e.name)).mtime.getTime()
      }))
      .filter(f => f.name.toLowerCase().includes(cleanTitle.substring(0, 20)))
      .sort((a, b) => b.time - a.time);
    
    return matchingFolders.length > 0 ? matchingFolders[0].path : null;
  } catch (err) {
    console.warn('findPlaywrightTestFolder error:', err.message);
    return null;
  }
}

/**
 * Show small failure banner on page before test ends
 */
async function showSmallFailureBanner(page, message, type = 'FAILURE') {
  try {
    if (page.isClosed()) return;
    
    await showTestFailure(page, message, type);
  } catch (err) {
    console.warn('Could not show failure banner:', err.message);
  }
}

/**
 * Rename Playwright auto-generated files inside their original folders
 * Delete original files, keep only renamed ones
 */
async function renamePlaywrightArtifacts(testFolder, testFile, testTitle, reason) {
  const renamedFiles = [];
  
  try {
    if (!testFolder || !fs.existsSync(testFolder)) {
      logInfo('No test folder found for artifact renaming');
      return renamedFiles;
    }
    
    const entries = await fsPromises.readdir(testFolder);
    
    for (const entry of entries) {
      const entryPath = path.join(testFolder, entry);
      const stat = await fsPromises.stat(entryPath);
      
      if (stat.isDirectory()) continue;
      
      // Handle video.webm
      if (entry === 'video.webm') {
        const newFilename = formatArtifactFilename(testFile, testTitle, reason, 'webm');
        const newPath = path.join(testFolder, newFilename);
        
        await fsPromises.rename(entryPath, newPath);
        logInfo('Renamed video', { from: entry, to: newFilename });
        renamedFiles.push(newPath);
      }
      
      // Handle trace.zip
      if (entry === 'trace.zip') {
        const newFilename = formatArtifactFilename(testFile, testTitle, reason, 'zip');
        const newPath = path.join(testFolder, newFilename);
        
        await fsPromises.rename(entryPath, newPath);
        logInfo('Renamed trace', { from: entry, to: newFilename });
        renamedFiles.push(newPath);
      }
      
      // Handle test-failed-1.png, test-failed-2.png, etc.
      if (entry.match(/^test-failed-\d+\.png$/)) {
        const newFilename = formatArtifactFilename(testFile, testTitle, reason, 'png');
        const newPath = path.join(testFolder, newFilename);
        
        await fsPromises.rename(entryPath, newPath);
        logInfo('Renamed screenshot', { from: entry, to: newFilename });
        renamedFiles.push(newPath);
      }
    }
  } catch (err) {
    console.warn('renamePlaywrightArtifacts error:', err.message);
  }
  
  return renamedFiles;
}

/**
 * Auto-setup fixture for test context
 */
export const autoSetup = base.extend({
  context: async ({ context }, use) => {
    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    // Set context before test
    setContext({
      testcase: testInfo.title,
      testFile: testInfo.file
    });
    
    await use(page);
  }
});

/**
 * Extended test with afterEach hook for artifact handling
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    // Setup before test
    setContext({
      testcase: testInfo.title,
      testFile: testInfo.file
    });
    clearArtifacts();
    clearDiagnostics();
    
    await use(page);
    
    // After test completes - handle artifacts
    const testFailed = testInfo.status === 'failed' || testInfo.status === 'timedOut';
    const testPassed = testInfo.status === 'passed';
    const hasWarnings = getArtifacts().length > 0;
    
    if (testFailed) {
      const error = testInfo.error;
      const reason = extractErrorReason(error);
      const errorMessage = error?.message || 'Test failed';
      
      // Show SMALL failure banner before test ends
      await showSmallFailureBanner(page, errorMessage, 'FAILURE');
      
      // Wait for video to be written
      await page.waitForTimeout(1000);
      
      // Find Playwright's test folder and rename artifacts inside it
      const pwFolder = await findPlaywrightTestFolder(testInfo.title);
      if (pwFolder) {
        await renamePlaywrightArtifacts(pwFolder, testInfo.file, testInfo.title, reason);
      }
      
      logInfo('Test failed, artifacts renamed', { 
        reason, 
        folder: pwFolder,
        error: errorMessage.substring(0, 100)
      });
    } else if (hasWarnings && testPassed) {
      // Test passed but had warnings
      const warningMsg = `Test passed with ${getArtifacts().length} warning(s)`;
      
      await showSmallFailureBanner(page, warningMsg, 'WARNING');
      await page.waitForTimeout(500);
      
      // Rename with WARNING reason
      const pwFolder = await findPlaywrightTestFolder(testInfo.title);
      if (pwFolder) {
        await renamePlaywrightArtifacts(pwFolder, testInfo.file, testInfo.title, 'WARNING');
      }
    }
    
    // Cleanup
    clearContext();
  }
});

export { expect } from '@playwright/test';

/**
 * Standalone afterEach hook for use in test files
 * Call this in test.afterEach() for additional cleanup
 */
export async function handleTestArtifacts(page, testInfo) {
  const testFailed = testInfo.status === 'failed' || testInfo.status === 'timedOut';
  
  if (testFailed && page && !page.isClosed()) {
    const error = testInfo.error;
    const reason = extractErrorReason(error);
    const errorMessage = error?.message || 'Test failed';
    
    // Show small banner
    await showSmallFailureBanner(page, errorMessage, 'FAILURE');
    
    // Wait for video
    await page.waitForTimeout(1000);
    
    // Rename artifacts
    const pwFolder = await findPlaywrightTestFolder(testInfo.title);
    if (pwFolder) {
      await renamePlaywrightArtifacts(pwFolder, testInfo.file, testInfo.title, reason);
    }
  }
}

export default {
  test,
  expect: test.expect,
  autoSetup,
  handleTestArtifacts,
  showSmallFailureBanner,
  findPlaywrightTestFolder,
  renamePlaywrightArtifacts
};
