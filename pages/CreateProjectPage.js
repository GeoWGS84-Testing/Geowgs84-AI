// pages/CreateProjectPage.js
import { BasePage } from './BasePage';
import { logInfo, addWarning, addError, highlight, showStep, robustClick, fastWait, annotateElementLabel } from '../utils/helpers';
import { expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class CreateProjectPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = 'https://platform.geowgs84.ai/#/creategisproject';
    this.container = page.locator('div.container-lg', { hasText: 'Create GIS Project' });

    // Inputs
    this.nameInput = page.locator('input[placeholder="Enter project name"], input[name="projectName"], input[aria-label="Project Name"]').first();
    this.submitBtn = page.locator('button.btn.btn-success[type="submit"]');

    // Selects
    this.dataTypeSelect = () => this.container.locator('select.form-select').nth(0);
    this.datasetSelect = () => this.container.locator('select.form-select').nth(1);
    this.subDatasetSelect = () => this.container.locator('select.form-select').nth(2);
    this.analysisSelect = () => this.page.locator('select.form-select').filter({ hasText: 'Object Detection' });
    this.modelTypeSelect = () => this.page.locator('select.form-select').filter({ hasText: 'Finetuned Public Model' });
    this.pretrainedSelect = () => this.page.locator("//div[@class='row mb-4 justify-content-center']//div[2]//select[1]");

    // Upload Modal
    this.uploadModal = page.locator('div.modal-content:has-text("Upload Model")');
    this.uploadSuccessModal = page.locator('div.modal-content:has-text("Success")');
    
    // Your Created Model
    this.yourModelsSelect = () => this.container.locator('div.col-xl-4.col-md-6.col-12:has(label.fw-bold:has-text("Your Models")) > select.form-select');

    // Success Popup
    this.successModal = page.locator('div.modal-content:has(h4:has-text("Project created successfully"))');
  }

  // --- Navigation ---
  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    await this.container.waitFor({ timeout: 30000 });
    logInfo('Navigated to Create GIS Project page');
  }

  // --- Form Actions ---
  async enterProjectName(name) {
    await highlight(this.page, this.nameInput);
    await annotateElementLabel(this.page, this.nameInput, 'Project Name');
    await this.nameInput.click();
    try { await this.nameInput.click({ clickCount: 3 }) } catch {}
    try {
      await this.nameInput.press('Backspace');
      await this.nameInput.press('Control+A');
      await this.nameInput.press('Backspace');
    } catch {}
    await this.nameInput.fill(name);
    logInfo('Project Name:', { projectName: name });
  }

  isPlaceholder(text) {
    const t = (text || '').toLowerCase().trim();
    return !t || t.startsWith('--') || t.startsWith('select') || t.includes('select a') || t.includes('pre-trained');
  }

  cleanOptions(list) {
    return list.map(v => v.trim()).filter(v => !this.isPlaceholder(v));
  }

  async listOptionsText(select) {
    const opts = await select.locator('option').all();
    return Promise.all(opts.map(o => o.innerText()));
  }

  async inspectAndSelect(select, stepText = null, index = 1, doSelect = true) {
    if (stepText) await showStep(this.page, stepText);
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    
    try {
        await select.locator('option').first().waitFor({ state: 'attached', timeout: 5000 });
    } catch (e) { /* Proceed if timeout */ }

    const raw = await this.listOptionsText(select);
    const cleaned = this.cleanOptions(raw);
    if (stepText) {
      logInfo(`${stepText} options: ${JSON.stringify(cleaned, null, 2)}`);
      logInfo(`${stepText} Count: ${cleaned.length}`);
    }
    if (doSelect && cleaned.length > 0) {
      let targetIndex = Math.min(index, raw.length - 1);
      if (this.isPlaceholder(raw[targetIndex])) {
        const valid = raw.findIndex(o => !this.isPlaceholder(o));
        if (valid !== -1) targetIndex = valid;
      }
      await select.selectOption({ index: targetIndex });
    }
    return cleaned;
  }

  async selectAnyValidOption(select) {
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    const options = await select.locator('option').all();
    for (let i = 0; i < options.length; i++) {
      const text = (await options[i].innerText()).trim().toLowerCase();
      if (text && !text.includes('select')) {
        await select.selectOption({ index: i });
        return;
      }
    }
    await addError('No valid option found to select', {}, true);
  }

  async SelectDataType() {
    await this.selectAnyValidOption(this.dataTypeSelect());
  }

  async SelectPublicDataset() {
    const datasetSelect = this.datasetSelect();
    await datasetSelect.waitFor({ state: 'visible' });
    await highlight(this.page, datasetSelect);
    await datasetSelect.selectOption({ label: 'Public Dataset' });
    await fastWait(this.page, 800);

    const subSelect = this.subDatasetSelect();
    await subSelect.waitFor({ state: 'visible' });
    await highlight(this.page, subSelect);
    await subSelect.selectOption({ label: 'NAIP (6 inches / 1 meter m)' });
    await fastWait(this.page, 800);
  }

  async selectUploadedDatasetOrWarn() {
    const datasetSelect = this.datasetSelect();
    await datasetSelect.waitFor({ state: 'visible' });
    await highlight(this.page, datasetSelect);
    await datasetSelect.selectOption({ label: 'Uploaded Dataset' });
    await fastWait(this.page, 800);

    const subSelect = this.subDatasetSelect();
    await subSelect.waitFor({ state: 'visible' });
    await highlight(this.page, subSelect);

    const warningAlert = this.container.locator('div.alert.alert-warning, div.alert-warning');
    if ((await warningAlert.count()) > 0) {
      const alertText = (await warningAlert.first().innerText()).trim();
      if (/no datasets with valid wms|no valid datasets/i.test(alertText)) {
        const warningMsg = `⚠️ ${alertText} — Please upload a valid dataset before running this test.`;
        await showStep(this.page, warningMsg);
        await highlight(this.page, subSelect, { borderColor: 'red', pause: 1000 });
        await highlight(this.page, warningAlert.first(), { borderColor: 'orange', pause: 1200 });
        return null;
      }
    }

    const rawOptions = await subSelect.locator('option').all();
    const datasets = [];
    
    for (const opt of rawOptions) {
      const text = (await opt.innerText()).trim();
      const isDisabled = (await opt.getAttribute('disabled')) !== null;
      if (text && !text.toLowerCase().includes('select') && !text.toLowerCase().includes('upload new') && !isDisabled) {
        datasets.push(text);
      }
    }

    logInfo(`Found ${datasets.length} valid uploaded datasets.`);

    if (datasets.length === 0) {
      const warningMsg = '⚠️ No uploaded datasets found. Please upload a valid dataset before running this test.';
      await showStep(this.page, warningMsg);
      await highlight(this.page, subSelect, { borderColor: 'red', pause: 1500 });
      return null;
    }

    await showStep(this.page, `Selecting uploaded dataset: ${datasets[0]}`);
    await highlight(this.page, subSelect, { borderColor: 'red', pause: 1500 });
    await subSelect.selectOption({ label: datasets[0] });
    await fastWait(this.page, 800);
    logInfo('Selected Uploaded Dataset:', { dataset: datasets[0] });
    return datasets[0];
  }

  async SelectAnalysisType() {
    await this.selectAnyValidOption(this.analysisSelect());
  }

  async SelectFinetunedModel() {
    const select = this.modelTypeSelect();
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    await select.selectOption({ label: 'Finetuned Public Model' });
    await fastWait(this.page, 800);
  }

  async SelectPretrainedModel() {
    await this.selectAnyValidOption(this.pretrainedSelect());
  }

  async SelectCreateNewModel() {
    const select = this.modelTypeSelect();
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    await select.selectOption({ label: 'Create New Model' });
    await fastWait(this.page, 800);
  }

  async SelectUploadModel() {
    const select = this.modelTypeSelect();
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    await select.selectOption({ label: 'Upload Model' });
    await fastWait(this.page, 800);
  }

  async SelectYourCreatedModel() {
    const select = this.modelTypeSelect();
    await select.waitFor({ state: 'visible' });
    await highlight(this.page, select);
    await select.selectOption({ label: 'Your Created Model' });
    await fastWait(this.page, 800);
  }

  async selectAnyYourCreatedModelOrWarn() {
    const select = this.yourModelsSelect();
    await select.waitFor({ state: 'visible', timeout: 10000 });
    await highlight(this.page, select);

    const options = await select.locator('option').all();
    const validOptions = [];
    for (const opt of options) {
      const text = (await opt.innerText()).trim();
      if (text && !text.toLowerCase().includes('select')) {
        validOptions.push(text);
      }
    }

    if (validOptions.length === 0) {
      const msg = '⚠️ No "Your Created Model" found. Please annotate and create a model before running TC-6.';
      await showStep(this.page, msg);
      addWarning(msg);
      await highlight(this.page, select, { pause: 1000 });
      return false;
    }

    await showStep(this.page, `Selecting Your Created Model: ${validOptions[0]}`);
    await select.selectOption({ label: validOptions[0] });
    await fastWait(this.page, 800);
    logInfo('Selected Your Created Model:', { model: validOptions[0] });
    return true;
  }

  async uploadModelViaPopup() {
    const modal = this.uploadModal;
    await modal.waitFor({ state: 'visible', timeout: 30000 });
    await showStep(this.page, 'Upload Model popup opened');

    const filePath = path.resolve(process.cwd(), 'utils', 'testdata', 'Uploadmodel.pth');
    logInfo('Uploading file from:', { filePath });
    if (!fs.existsSync(filePath)) {
      await addError(`Upload file not found at path: ${filePath}`, {}, true);
    }

    // 1. File Input
    const fileInput = modal.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await fastWait(this.page, 800);

    // 2. Model Name
    const nameSelectors = ['input[placeholder*="Enter model name"]', 'input[placeholder*="Model Name"]', 'input[name="modelName"]', 'input[type="text"]'];
    let nameInput = null;
    for (const sel of nameSelectors) {
      const cand = modal.locator(sel).first();
      if ((await cand.count()) > 0) { nameInput = cand; break; }
    }
    if (!nameInput) nameInput = modal.locator('input').first();
    
    const modelName = `UploadModel-${Date.now()}`;
    try { 
      await nameInput.fill(''); 
      await nameInput.type(modelName, { delay: 30 }); 
      await highlight(this.page, nameInput); 
    } catch (e) { 
      try { await nameInput.fill(modelName); } catch (e2) {} 
    }

    // 3. Description
    const descCandidates = [modal.locator('textarea[placeholder*="Description"]'), modal.locator('textarea[name="description"]'), modal.locator('textarea')];
    for (const d of descCandidates) { 
      if ((await d.count()) > 0 && await d.isVisible().catch(() => false)) { 
        try { await d.fill('Uploaded by automation test'); await highlight(this.page, d); } catch (e) {}; 
        break; 
      } 
    }

    // 4. Min/Max Resolution
    const minSelectors = ['input[placeholder*="e.g. 10.5"]', 'input[placeholder*="Min"]', 'input[name="min_resolution"]', 'input[aria-label*="Minimum"]'];
    const maxSelectors = ['input[placeholder*="e.g. 100.0"]', 'input[placeholder*="Max"]', 'input[name="max_resolution"]', 'input[aria-label*="Maximum"]'];

    let minInput = null; 
    for (const s of minSelectors) { const c = modal.locator(s).first(); if ((await c.count()) > 0) { minInput = c; break; } }
    if (!minInput) minInput = modal.locator('input').nth(1);

    let maxInput = null; 
    for (const s of maxSelectors) { const c = modal.locator(s).first(); if ((await c.count()) > 0) { maxInput = c; break; } }
    if (!maxInput) maxInput = modal.locator('input').nth(2);

    const minResValue = '7'; const maxResValue = '80';
    
    try { if (minInput) { await minInput.fill(''); await minInput.type(minResValue, { delay: 20 }); await highlight(this.page, minInput); } } catch (e) { try { await minInput.fill(minResValue); } catch (e) {} }
    try { if (maxInput) { await maxInput.fill(''); await maxInput.type(maxResValue, { delay: 20 }); await highlight(this.page, maxInput); } } catch (e) { try { await maxInput.fill(maxResValue); } catch (e) {} }

    await this.page.waitForTimeout(600);

    // 5. Upload Button
    const uploadBtnCandidates = [modal.getByRole('button', { name: /upload/i }), modal.locator('button.btn-primary:has-text("Upload")'), modal.locator('button:has-text("Upload Model")'), modal.locator('button[type="submit"]:has-text("Upload")')];
    let uploadBtn = null;
    for (const b of uploadBtnCandidates) { if ((await b.count()) > 0) { uploadBtn = b.first(); break; } }
    if (!uploadBtn) { const anyPrimary = modal.locator('button.btn-primary').first(); if ((await anyPrimary.count()) > 0) uploadBtn = anyPrimary; }
    if (!uploadBtn) throw new Error('Upload button not found in upload modal');

    try { await expect(uploadBtn).toBeEnabled({ timeout: 20000 }) } catch (e) {
      logInfo('Upload button did not become enabled within 20s; waiting extra 10s');
      await this.page.waitForTimeout(10000);
      if (!(await uploadBtn.isEnabled().catch(() => false))) throw new Error('Upload button remained disabled after file attach.');
    }
    
    await highlight(this.page, uploadBtn);
    await robustClick(this.page, uploadBtn);
    logInfo('Upload button clicked — waiting for result');

    // FIX: Wait for Success Modal, Error Modal, OR Modal Closing (implicit success)
    const successModal = this.page.locator('div.modal-content:has-text("Success"), div.swal2-popup:has-text("Success")');
    const errorModal = this.page.locator('div.modal-content:has-text("Error"), div.swal2-popup:has-text("Error")');

    const UPLOAD_TIMEOUT = 180000;
    
    try {
        await Promise.race([
            successModal.waitFor({ state: 'visible', timeout: UPLOAD_TIMEOUT }),
            errorModal.waitFor({ state: 'visible', timeout: UPLOAD_TIMEOUT }),
            modal.waitFor({ state: 'hidden', timeout: UPLOAD_TIMEOUT })
        ]);
    } catch (e) {
        throw new Error('Upload did not complete successfully (timeout).');
    }

    if (await errorModal.isVisible().catch(() => false)) {
      const errorText = await errorModal.locator('div.modal-body, p, .swal2-html-container').first().innerText().catch(() => 'Unknown error');
      await addError(`Model upload failed: ${errorText}`, {}, true);
    }

    if (await successModal.isVisible().catch(() => false)) {
      await showStep(this.page, 'Upload Success modal appeared');
      const closeBtn = successModal.locator('button.btn-secondary:has-text("Close"), button:has-text("OK")').first();
      if (await closeBtn.isVisible()) {
        await robustClick(this.page, closeBtn);
        await successModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
      logInfo('Upload finished successfully (modal visible).');
      return modelName;
    }

    // If we reach here, the modal closed without error, assume success
    if (await modal.isHidden().catch(() => true)) {
      await showStep(this.page, 'Upload modal closed (Success assumed)');
      return modelName;
    }

    throw new Error('Neither success nor error modal appeared after upload.');
  }

  async handleUploadSuccessPopup() {
    const successModal = this.uploadSuccessModal;
    await successModal.waitFor({ state: 'visible', timeout: 30000 }); 
    await highlight(this.page, successModal, { pause: 800 });
    
    const closeBtn = successModal.locator('button.btn-secondary:has-text("Close")');
    await closeBtn.waitFor({ state: 'visible' });
    await highlight(this.page, closeBtn);
    await robustClick(this.page, closeBtn);

    await successModal.waitFor({ state: 'hidden', timeout: 30000 });
    logInfo('Upload Success modal closed');
  }

  async clickCreateProjectButton() {
    const btn = this.submitBtn;
    await btn.waitFor({ state: 'visible' });
    await expect(btn).toBeEnabled({ timeout: 10000 });
    await highlight(this.page, btn);

    const form = btn.locator('xpath=ancestor::form');
    const isValid = await form.evaluate(f => f.checkValidity());
    logInfo('Form valid before submit:', { isValid });

    if (!isValid) {
      const invalidFields = await form.evaluate(f =>
        Array.from(f.querySelectorAll(':invalid')).map(el => ({
          name: el.name, id: el.id, placeholder: el.placeholder
        }))
      );
      addWarning('Form is invalid. Submission blocked.', { invalidFields });
      throw new Error('Form is invalid. Submission blocked.');
    }

    try {
      await form.evaluate(f => f.requestSubmit());
      logInfo('Form submitted via requestSubmit()');
    } catch (e) {
      addWarning('requestSubmit failed; falling back to button click', { error: String(e) });
      await robustClick(this.page, btn);
    }
  }

  async HandleSuccessPopupAndGoToDashboard() {
    const modal = this.successModal;
    await modal.waitFor({ state: 'visible', timeout: 60000 });
    await highlight(this.page, modal, { pause: 800 });

    const okButton = modal.locator('button.btn-primary:has-text("OK")');
    await okButton.waitFor({ state: 'visible' });
    await highlight(this.page, okButton);
    await robustClick(this.page, okButton);
    await modal.waitFor({ state: 'hidden', timeout: 30000 });

    await this.page.waitForLoadState('networkidle');
    await fastWait(this.page, 1500);
    await this.page.goto('https://platform.geowgs84.ai/#/dashboard', { waitUntil: 'networkidle' });
    await fastWait(this.page, 1500);
  }

  async HandleSuccessPopupAndGoToProject() {
    const modal = this.successModal;
    await modal.waitFor({ state: 'visible', timeout: 60000 });
    await highlight(this.page, modal, { pause: 800 });

    const okButton = modal.locator('button.btn-primary:has-text("OK")');
    await okButton.waitFor({ state: 'visible' });
    await highlight(this.page, okButton);
    await robustClick(this.page, okButton);
    await modal.waitFor({ state: 'hidden', timeout: 30000 });

    await this.page.waitForLoadState('networkidle');
    await fastWait(this.page, 1500);
    await this.page.goto('https://platform.geowgs84.ai/#/projects', { waitUntil: 'networkidle' });
    await fastWait(this.page, 1500);
  }
}
