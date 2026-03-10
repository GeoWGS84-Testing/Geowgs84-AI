// pages/UploadPage.js
import { BasePage } from './BasePage';
import { logInfo, addWarning, highlight, robustClick, showStep, fastWait } from '../utils/helpers';
import { expect } from '@playwright/test';
import path from 'path';

export class UploadPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = 'https://platform.geowgs84.ai/#/uploadgisdata';
    
    // Locators
    this.fileInput = page.locator('div.bg-primary input[type="file"]');
    this.folderInput = page.locator('div.bg-success input[type="file"]');
    this.zipInput = page.locator('div.bg-warning input[type="file"]');
    
    this.datasetNameInput = page.locator('input[placeholder="Enter a name for your dataset"]');
    this.nameAvailableMsg = page.locator('div.text-success.small:has-text("Dataset name is available")');
    this.submitBtn = page.locator('div.row.text-center.mt-4 button[type="submit"]');
    
    this.tableBody = page.locator('div.rdt_TableBody');
    this.tableRow = page.locator('div[role="row"]');
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    logInfo('Navigated to Upload GIS Data page');
  }

  async uploadSingleFile(filePath) {
    await highlight(this.page, this.fileInput);
    await this.fileInput.setInputFiles(path.resolve(filePath));
    logInfo(`Uploaded file: ${filePath}`);
  }

  async uploadFolder(folderPath) {
    await highlight(this.page, this.folderInput);
    await this.folderInput.setInputFiles(path.resolve(folderPath));
    logInfo(`Uploaded folder: ${folderPath}`);
  }

  async uploadZip(zipPath) {
    await highlight(this.page, this.zipInput);
    await this.zipInput.setInputFiles(path.resolve(zipPath));
    logInfo(`Uploaded zip: ${zipPath}`);
  }

  async enterDatasetName(name) {
    await highlight(this.page, this.datasetNameInput);
    await this.datasetNameInput.fill(name);
    logInfo(`Dataset name set: ${name}`);
  }

  async submitUpload() {
    const submitBtn = this.submitBtn;
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.scrollIntoViewIfNeeded();
    await highlight(this.page, submitBtn);
    
    // Double Click Logic
    await robustClick(this.page, submitBtn);
    await fastWait(this.page, 500);
    await robustClick(this.page, submitBtn);
    logInfo('Submit button clicked twice');
    
    try {
        await this.page.locator('div.row.text-center.mt-4 button[type="submit"]:disabled')
          .waitFor({ state: 'visible', timeout: 5000 });
        logInfo('Upload started (Button disabled)');
    } catch (e) {
        logInfo('Button state change not detected');
    }
  }

  async handleUploadSummaryModal() {
    const modal = this.page.locator('div.modal-content:has-text("Upload Summary")');
    await modal.waitFor({ state: 'visible', timeout: 300000 });
    await highlight(this.page, modal);
    await this.page.waitForTimeout(1000);

    const successText = await modal.locator('h5:has-text("Successful Uploads")').textContent().catch(() => '0');
    const failedText = await modal.locator('h5:has-text("Failed Uploads")').textContent().catch(() => '0');
    logInfo(`Upload Summary -> ${successText}, ${failedText}`);

    const closeBtn = modal.locator('button.btn.btn-secondary:has-text("Close")');
    await closeBtn.waitFor({ state: 'visible' });
    await highlight(this.page, closeBtn);
    await robustClick(this.page, closeBtn);
    await modal.waitFor({ state: 'hidden' });
    logInfo('Upload Summary modal closed');
  }

  // Updated: Removed the strict name check as the popup does not show the name
  async handleSwalDeleteConfirmation(expectedName = null) {
    const warningPopup = this.page.locator('.swal2-popup.swal2-icon-warning');
    await expect(warningPopup).toBeVisible({ timeout: 30000 });

    // Log popup text for debugging purposes
    const title = await warningPopup.locator('.swal2-title').innerText().catch(() => '');
    const content = await warningPopup.locator('.swal2-content, .swal2-html-container').innerText().catch(() => '');
    const popupText = `${title} ${content}`.trim();
    logInfo(`Delete confirmation popup text: "${popupText}"`);

    // We no longer assert that the name is in the popup text because the UI doesn't support it
    
    const yesBtn = warningPopup.locator('button.swal2-confirm.btn-danger:has-text("Yes")');
    await highlight(this.page, yesBtn);
    await robustClick(this.page, yesBtn);

    const successPopup = this.page.locator('.swal2-popup.swal2-icon-success');
    await expect(successPopup).toBeVisible({ timeout: 30000 });

    const okBtn = successPopup.locator('button.swal2-confirm.btn-success:has-text("OK")');
    await highlight(this.page, okBtn);
    await robustClick(this.page, okBtn);

    await expect(successPopup).toBeHidden({ timeout: 30000 });
    logInfo('Delete confirmation handled');
  }

  async verifyAndCloseErrorPopup(expectedText) {
    const errorPopup = this.page.locator(`div.swal2-popup h2:has-text("${expectedText}")`);
    await errorPopup.waitFor({ state: 'visible' });
    await highlight(this.page, errorPopup);
    await this.page.locator('button.swal2-confirm').click();
    logInfo('Error popup closed');
  }

  async verifyDatasetInTable(datasetName) {
    // 1. Wait for the Table Body
    await this.tableBody.waitFor({ timeout: 30000 });
    
    // 2. Wait for at least one row to appear
    await expect(this.tableBody.locator(this.tableRow)).not.toHaveCount(0, { timeout: 30000 });

    // 3. Get the FIRST row
    const firstRow = this.tableBody.locator(this.tableRow).first();
    
    // 4. Locate the name cell
    const datasetCell = firstRow.locator('div[data-column-id="2"] div');
    
    // 5. Get text and verify
    const text = await datasetCell.innerText();
    
    logInfo(`Latest uploaded dataset name: ${text}`);
    if (text === datasetName) logInfo('Dataset names match');
    else addWarning('Dataset names differ', { expected: datasetName, actual: text });

    await highlight(this.page, datasetCell);
    await expect(datasetCell).toHaveText(datasetName);
    
    return firstRow;
  }

  async findAndDeleteDataset(expectedDatasetName) {
    const tableBody = this.tableBody;
    await tableBody.waitFor({ timeout: 30000 });

    const rows = tableBody.locator(this.tableRow);
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const nameCell = row.locator('div[data-column-id="2"] div');
      await expect(nameCell).toBeVisible({ timeout: 10000 });
      const actualName = (await nameCell.innerText()).trim();

      logInfo(`Row ${i} dataset name: ${actualName}`);

      if (actualName !== expectedDatasetName) {
        continue;
      }

      await highlight(this.page, nameCell);
      await showStep(this.page, `Verified dataset in table: ${actualName}`);
      await expect(nameCell).toHaveText(expectedDatasetName);

      const deleteBtn = row.locator('button.btn.btn-danger.btn-sm:has-text("Delete")');

      await highlight(this.page, deleteBtn);
      await showStep(this.page, `Deleting dataset: ${actualName}`);
      await robustClick(this.page, deleteBtn);

      await this.handleSwalDeleteConfirmation(expectedDatasetName);
      await showStep(this.page, `Your Created Model project "${expectedDatasetName}" deleted successfully`);
      return;
    }

    throw new Error(`Dataset not found in table: ${expectedDatasetName}`);
  }

  async handlePublishAndViewerFlow(firstRow) {
    const publishBtn = firstRow.locator('div[data-column-id="9"] button:has-text("Publish")');
    await expect(publishBtn).toBeVisible({ timeout: 30000 });
    await highlight(this.page, publishBtn);
    await robustClick(this.page, publishBtn);
    logInfo('Publish modal handled');

    const viewBtn = firstRow.locator('div[data-column-id="9"] button:has-text("View")');
    await expect(viewBtn).toBeVisible({ timeout: 120000 });
    await highlight(this.page, viewBtn);

    await this.openAndCloseModal(firstRow.locator('div[data-column-id="7"] button:has-text("WMS")'), 'WMS');
    await this.openAndCloseModal(firstRow.locator('div[data-column-id="8"] button:has-text("WCS")'), 'WCS');

    await robustClick(this.page, viewBtn);
    const canvas = this.page.locator('div.modal-content canvas');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await highlight(this.page, canvas);
    await this.closeGenericModal();
    logInfo('View modal handled');
  }

  async openAndCloseModal(triggerBtn, label) {
    await expect(triggerBtn).toBeVisible({ timeout: 30000 });
    await highlight(this.page, triggerBtn);
    await robustClick(this.page, triggerBtn);
    await this.closeGenericModal();
    logInfo(`${label} modal handled`);
  }

  async closeGenericModal() {
    const closeBtn = this.page.locator('div.modal-content button.btn-secondary:has-text("Close")');
    await expect(closeBtn).toBeVisible({ timeout: 30000 });
    await highlight(this.page, closeBtn);
    await robustClick(this.page, closeBtn);
  }
}