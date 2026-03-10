// pages/DatasetsPage.js
import { BasePage } from './BasePage';
import { logInfo, addWarning, highlight, showStep, fastWait, getInnerTextSafe, robustClick } from '../utils/helpers';
import { expect } from '@playwright/test';

export class DatasetsPage extends BasePage {
  constructor(page) {
    super(page);
    this.datasetsMenu = page.locator('a.nav-group-toggle', { hasText: 'Datasets' });
    this.publicLink = page.getByRole('link', { name: 'Public Dataset' });
    this.uploadedLink = page.getByRole('link', { name: 'Uploaded Datasets' });
    this.purchasedLink = page.getByRole('link', { name: 'Purchased Datasets' });
  }

  async openDatasetsMenu() {
    // FIX: Ensure scroll into view to prevent 'outside viewport' errors
    await this.datasetsMenu.scrollIntoViewIfNeeded();
    await fastWait(this.page, 300);
    await robustClick(this.page, this.datasetsMenu);
    await fastWait(this.page, 500); // Wait for animation
  }

  async gotoPublicDatasets() {
    await robustClick(this.page, this.publicLink);
    await this.verifyHeading('Public Datasets');
  }

  async gotoUploadedDatasets() {
    await robustClick(this.page, this.uploadedLink);
    await this.verifyHeading('Your Uploaded Datasets');
  }

  async gotoPurchasedDatasets() {
    await robustClick(this.page, this.purchasedLink);
    await expect(this.page).toHaveURL(/#\/purchaseddataset/i);
  }

  async verifyHeading(text) {
    const heading = this.page.locator('.card-header h5, .card-header.bg-primary h5', { hasText: text });
    await expect(heading).toBeVisible();
    await highlight(this.page, heading);
  }

  async extractDatasetNameFromRow(row) {
    try {
      const second = row.locator('td').nth(1);
      if (await second.count() > 0) {
        const t = await getInnerTextSafe(second);
        if (t) return t;
        const child = second.locator('a, .dataset-name, .name, strong, h4, span').first();
        if (await child.count() > 0) {
          const t2 = await getInnerTextSafe(child);
          if (t2) return t2;
        }
      }
    } catch {}
    try {
      const first = row.locator('td').first();
      const t = await getInnerTextSafe(first);
      if (t) return t;
    } catch {}
    return 'UNKNOWN DATASET NAME';
  }

  async processTableRows(tableLocator, rowHandler) {
    await expect(tableLocator).toBeVisible();
    const rows = tableLocator.locator('tbody tr');
    const count = await rows.count();
    const names = [];
    
    for (let i = 0; i < count; i++) {
      names.push(await this.extractDatasetNameFromRow(rows.nth(i)));
    }

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      await rowHandler(row, i, names[i]);
    }
  }

  async clickActionAndWaitForView(row, actionBtn) {
    const btnText = (await getInnerTextSafe(actionBtn)).trim();
    logInfo(`Action button text: "${btnText}"`);

    if (/publish/i.test(btnText)) {
      await robustClick(this.page, actionBtn);
      logInfo('Publish clicked. Waiting for View button...');

      const viewBtn = await (async () => {
        const start = Date.now();
        const timeout = 60000; 
        while (Date.now() - start < timeout) {
          try {
            const currentBtn = row.locator('td').nth(8).locator('button').first();
            const text = (await getInnerTextSafe(currentBtn)).toLowerCase();
            if (text.includes('view')) return currentBtn;
          } catch {}
          await this.page.waitForTimeout(1000);
        }
        throw new Error(`Timed out waiting for "View" button after Publish`);
      })();

      return viewBtn;
    } else if (/view/i.test(btnText)) {
      return actionBtn;
    } else {
      return null; 
    }
  }

  async handleModalClose(locator) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await highlight(this.page, locator);
      await robustClick(this.page, locator);
    } catch (e) { /* Swallow */ }
  }
}