// pages/DashboardPage.js
import { BasePage } from './BasePage';
import { logInfo, addWarning, highlight, fastWait, showTestFailure } from '../utils/helpers';
import { expect } from '@playwright/test';

export class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.dashboardUrl = 'https://platform.geowgs84.ai/#/dashboard';
    this.cards = page.locator('.card');
    this.socialRow = page.locator('div.row.g-4.mb-4', { hasText: /followers.*channels/i }).first();
    
    // Create Project Card
    this.createProjectCard = page.locator('div.card.bg-primary.text-white:has-text("Create GIS Project")');
    this.createProjectCardCount = this.createProjectCard.locator('div.fs-4.fw-semibold');
    
    // Upload Card
    this.uploadCard = page.locator('div.card.bg-info:has-text("Upload GIS Data")');
    this.uploadCardCounter = this.uploadCard.locator('div.fs-4.fw-semibold');

    // System Status Section
    this.systemStatusSection = page.locator('div.p-4.border.border.rounded', { hasText: 'All systems Up' }).first();
    this.globalSpinner = page.locator('.spinner-border, .loading, .overlay-loading, .page-loader, .loading-overlay');
  }

  async waitForDashboardReady(timeout = 60000) {
    try {
      await this.page.waitForURL('**/#/dashboard', { timeout });
    } catch (e) {
      logInfo('waitForDashboardReady: URL did not settle, proceeding anyway');
    }

    try {
      await this.uploadCard.waitFor({ state: 'visible', timeout: Math.min(20000, timeout) });
    } catch (e) {
      logInfo('waitForDashboardReady: uploadCard not visible');
    }

    try {
      await this.globalSpinner.waitFor({ state: 'hidden', timeout: 15000 });
    } catch (e) {}

    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {}

    // Extra wait for counters to settle
    await fastWait(this.page, 2000);
    logInfo('Dashboard ready or best-effort ready checks complete');
  }

  async goto() {
    await this.page.goto(this.dashboardUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForDashboardReady(30000);
    logInfo('Dashboard loaded');
  }

  // --- Robust Counter Logic ---
  async #waitForStableCount(locator) {
    let current = '';
    let previous = '';
    
    // Try for up to 10 seconds
    for (let i = 0; i < 10; i++) {
      try {
        current = (await locator.innerText()).trim();
      } catch (e) {
        current = '';
      }

      // Check if it's a valid number
      if (current !== '' && !isNaN(Number(current))) {
        // Check if stable (hasn't changed in 1s)
        if (current === previous) {
          return current; 
        }
      }
      
      previous = current;
      await this.page.waitForTimeout(1000);
    }
    
    return current;
  }

  async #getCount(locator, label = '') {
    await this.waitForDashboardReady();
    
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    const countStr = await this.#waitForStableCount(locator);
    
    try {
      await highlight(this.page, locator);
    } catch (e) {}

    const count = Number(countStr);
    if (label) await this.showStep(`${label}: ${count}`);
    logInfo(`${label || 'Count'}: ${count}`);
    return count;
  }

  async getCreateProjectCardCount(label = '') {
    return this.#getCount(this.createProjectCardCount, label);
  }

  async getAndHighlightUploadCount(label = '') {
    return this.#getCount(this.uploadCardCounter, label);
  }

  async verifyCountIncreased(beforeCount, label = 'Valid Upload') {
    const afterCount = await this.getAndHighlightUploadCount(`After ${label}`);
    
    if (afterCount === beforeCount + 1) {
      logInfo(`✅ ${label} Verified: Count increased from ${beforeCount} to ${afterCount}`);
    } else {
      const errorMsg = `Count assertion failed. Expected ${beforeCount + 1}, found ${afterCount}`;
      addWarning(errorMsg);
      
      // SHOW FAILURE BANNER BEFORE THROWING
      await showTestFailure(this.page, errorMsg, 'FAILURE');
      
      throw new Error(`TEST FAILED: Expected count to be ${beforeCount + 1} but found ${afterCount}`);
    }
  }

  async verifyCountUnchanged(beforeCount, label = 'Invalid Upload') {
    const afterCount = await this.getAndHighlightUploadCount(`After ${label}`);
    logInfo(`Negative Test Check: Before=${beforeCount}, After=${afterCount}`);
    
    if (afterCount === beforeCount) {
      logInfo(`✅ Verified: Count remained stable at ${beforeCount} for ${label}`);
    } else {
      const errorMsg = `Count changed unexpectedly: ${beforeCount} → ${afterCount}`;
      addWarning(errorMsg);
      
      // SHOW FAILURE BANNER BEFORE THROWING
      await showTestFailure(this.page, errorMsg, 'FAILURE');
      
      throw new Error(`TEST FAILED: Count changed unexpectedly (${beforeCount} → ${afterCount})`);
    }
  }

  async clickCreateProject() {
    await this.robustClick(this.createProjectCard);
    await this.page.waitForURL('**/#/creategisproject');
    logInfo('Navigated to Create Project page via Dashboard card');
  }

  async verifyDashboardCards() {
    this.setFlow('dashboard-cards');
    const titles = ['Upload GIS Data', 'Create GIS Project', 'Purchase GIS Data', 'Download GIS Analysis'];
    for (const t of titles) {
      const locator = this.cards.filter({ hasText: t });
      if (await this.assertVisible(locator, `Card: ${t}`)) {
        await highlight(this.page, locator);
      }
    }
    this.clearFlow();
  }

  async verifyStorageAndGPU() {
    this.setFlow('storage-gpu');
    const storageCard = this.cards.filter({ has: this.page.locator('.card-header', { hasText: 'Storage Usage' }) });
    if (await this.assertVisible(storageCard, 'Storage Usage card')) {
      await highlight(this.page, storageCard);
    }

    const gpuCard = this.cards.filter({ has: this.page.locator('.card-header', { hasText: 'GPU Credit Usage' }) });
    if (await this.assertVisible(gpuCard, 'GPU Credit Usage card')) {
      await highlight(this.page, gpuCard);
      await this.assertVisible(gpuCard.locator('canvas'), 'GPU Canvas');
    }
    this.clearFlow();
  }

  async verifySystemStatusSection() {
    this.setFlow('system-status');
    await this.page.waitForSelector('.card', { timeout: 20000 });

    if (await this.assertVisible(this.systemStatusSection, 'System Status section')) {
      await highlight(this.page, this.systemStatusSection);

      const allSystemsUpCard = this.systemStatusSection.locator('.card-body', { hasText: 'All systems Up' }).first();
      if (await this.assertVisible(allSystemsUpCard, 'All systems Up card')) {
        await highlight(this.page, allSystemsUpCard);
        await this.assertVisible(allSystemsUpCard.locator('svg'), 'All systems Up - svg');
      }

      const uptime90DaysCard = this.systemStatusSection.locator('.card', { has: this.page.locator('.card-header', { hasText: /^Uptime\b/ }) });
      if (await this.assertVisible(uptime90DaysCard, 'Uptime card')) {
        await highlight(this.page, uptime90DaysCard);
      }

      const overallUptimeCard = this.systemStatusSection.locator('.card', { has: this.page.locator('.card-header', { hasText: 'Overall Uptime' }) });
      if (await this.assertVisible(overallUptimeCard, 'Overall Uptime card')) {
        await highlight(this.page, overallUptimeCard);
      }

      const statusUpdatesCard = this.systemStatusSection.locator('.card', { has: this.page.locator('.card-header', { hasText: 'Status updates' }) });
      if (await this.assertVisible(statusUpdatesCard, 'Status updates card')) {
        await highlight(this.page, statusUpdatesCard);
      }

      logInfo('System Status section verified');
    }
    this.clearFlow();
  }

  async verifySocialCards() {
    this.setFlow('social-cards');
    try {
      await this.socialRow.waitFor({ state: 'visible', timeout: 10000 });
      await highlight(this.page, this.socialRow);
      const columns = this.socialRow.locator('div.col-xxl-3');
      const count = await columns.count();
      for (let i = 0; i < count; i++) {
        const col = columns.nth(i);
        await highlight(this.page, col);
        const cardText = (await col.locator('.card-body .fs-5').textContent())?.trim() || '';
        logInfo(`Column ${i + 1} text`, { cardText });

        const link = col.locator('a').first();
        if (await link.count() > 0) {
          await this.openAndCloseNewPageFromClick(() => link.click(), `Social Card ${i + 1}`);
        }
      }
    } catch (err) {
      addWarning('Social cards verification incomplete', { error: err.message });
    }
    this.clearFlow();
  }

  async verifyMostUsedFineTunedModels() {
    this.setFlow('models');
    const section = this.cards.filter({ has: this.page.locator('.card-header', { hasText: 'Most Used Fine-Tuned Models' }) }).first();
    if (!(await this.assertVisible(section, 'Most Used Fine-Tuned Models section'))) {
      this.clearFlow();
      return;
    }
    await highlight(this.page, section);
    const table = section.locator('table.table');
    if (!(await this.assertVisible(table, 'Models table'))) {
      this.clearFlow();
      return;
    }

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    logInfo(`Found ${rowCount} rows in the table`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await highlight(this.page, row);
      const modelName = (await row.locator('td').nth(1).innerText()).trim();
      logInfo(`Row data`, { modelName });

      const button = row.locator('td').nth(3).locator('button', { hasText: 'View Description' });
      if (await button.count() > 0) {
        try {
          await this.openAndCloseNewPageFromClick(() => button.click(), `View Description Row ${i + 1}`);
        } catch (err) {
          addWarning(`Error opening View Description for row ${i + 1}`, { error: err.message });
        }
      }
    }
    this.clearFlow();
  }
}