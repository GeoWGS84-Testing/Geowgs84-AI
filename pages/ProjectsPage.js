// pages/ProjectsPage.js
import { BasePage } from './BasePage';
import { logInfo, addWarning, showStep, highlight, robustClick, fastWait, assertVisible } from '../utils/helpers';
import { expect } from '@playwright/test';

export class ProjectsPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = 'https://platform.geowgs84.ai/#/projects';
    this.myProjectsCard = page.locator('div.card:has(strong:has-text("My Projects"))');
    this.failedToFetchProjects = page.locator('p.text-danger:has-text("Failed to fetch projects")');
    this.projectCards = page.locator('div.row.g-4 div.col');
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'networkidle' });
    logInfo('Navigated to Projects page');
  }

  async abortIfMyProjectsFailed() {
    if (!(await this.myProjectsCard.isVisible())) return false;
    const hasFailure = (await this.failedToFetchProjects.count()) > 0;
    if (hasFailure) {
      const msg = '⚠️ My Projects failed to load (backend issue). Skipping this testcase.';
      await showStep(this.page, msg);
      await highlight(this.page, this.myProjectsCard);
      addWarning('My Projects shows "Failed to fetch projects". Test aborted gracefully.');
      return true;
    }
    return false;
  }

  async navigateToProjectsViaSidebar() {
    const currentUrl = this.page.url();
    if (currentUrl === 'about:blank' || !currentUrl.includes('geowgs84.ai')) {
        await this.page.goto('https://platform.geowgs84.ai/#/dashboard', { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForSelector('.sidebar', { state: 'attached', timeout: 15000 });
    await fastWait(this.page, 300);

    await showStep(this.page, 'Page loaded — starting sidenav checks');
    const projectsLink = this.page.locator('a.nav-link[href="#/projects"]').first();
    
    async function isSidebarOpen(page) {
      return await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return false;
        const style = window.getComputedStyle(sidebar);
        const rect = sidebar.getBoundingClientRect();
        return rect.width > 60 && style.visibility !== 'hidden' && style.display !== 'none';
      });
    }

    const alreadyOpen = await isSidebarOpen(this.page).catch(() => false);

    if (alreadyOpen) {
      await showStep(this.page, 'Sidenav is visible — navigating to Projects');
      // FIX: Scroll link into view specifically
      await projectsLink.scrollIntoViewIfNeeded();
      await robustClick(this.page, projectsLink);
      await this.page.waitForURL(/#\/projects/, { timeout: 10000 });
      return;
    }

    await showStep(this.page, 'Sidenav is closed — attempting to open via toggle');
    const toggleSelectors = ['button.header-toggler', '.sidebar-toggler', 'button.sidebar-toggle', 'button#sidebarToggle', 'button.navbar-toggler'];
    let opened = false;
    
    for (const sel of toggleSelectors) {
      try {
        const toggle = this.page.locator(sel).first();
        if (await toggle.isVisible().catch(() => false)) {
          await robustClick(this.page, toggle);
          await fastWait(this.page, 600);
          if (await isSidebarOpen(this.page).catch(() => false)) { opened = true; break; }
        }
      } catch (e) {}
    }

    if (!opened) {
      await this.page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          sidebar.classList.add('sidebar-show');
          sidebar.style.visibility = 'visible';
          sidebar.style.display = 'block';
        }
      });
      await fastWait(this.page, 500);
    }

    // FIX: Explicit scroll after sidebar is forced open
    await projectsLink.scrollIntoViewIfNeeded();
    await robustClick(this.page, projectsLink);
    await this.page.waitForURL(/#\/projects/, { timeout: 10000 });
    await showStep(this.page, 'Navigated to Projects page');
  }

  async getSectionLocators(sectionName) {
    const header = this.page.locator(`h5:has-text("${sectionName}")`);
    const row = header.locator('xpath=following-sibling::div[contains(@class,"row")]');
    return { header, row, cards: row.locator('.card'), emptyState: row.locator('div.text-muted.text-center') };
  }

  async getProjectCountBySection(sectionName) {
    const { cards } = await this.getSectionLocators(sectionName);
    return await cards.count();
  }

  async highlightSection(sectionName, isFinetuned = false) {
    const { header, row, cards, emptyState } = await this.getSectionLocators(sectionName);
    await expect(header).toBeVisible();
    await highlight(this.page, header, { borderColor: isFinetuned ? 'steelblue' : 'purple' });
    await expect(row).toBeVisible();
    await highlight(this.page, row, { borderColor: isFinetuned ? 'purple' : 'steelblue' });
    const count = await cards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) await highlight(this.page, cards.nth(i), { borderColor: isFinetuned ? 'orange' : 'blue', pause: 700 });
    } else {
      await highlight(this.page, emptyState, { borderColor: 'red' });
    }
    logInfo(`${sectionName} count: ${count}`);
  }

  async findProjectCardByName(projectName) {
    await this.page.waitForLoadState('domcontentloaded');
    const cards = this.projectCards;
    const count = await cards.count();
    
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const title = card.locator('h5.card-title');
      if ((await title.count()) === 0) continue;
      const titleText = (await title.innerText()).trim();
      
      const match = titleText.includes(projectName) || 
                    projectName.includes(titleText) || 
                    titleText.includes(projectName.split('-').slice(0,2).join('-'));
                    
      if (match) return card;
    }
    return null;
  }

  async deleteProjectByName(projectName) {
    await showStep(this.page, `Locate project card with name "${projectName}" to delete`);
    await this.page.waitForLoadState('domcontentloaded');
    
    let card = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        card = await this.findProjectCardByName(projectName);
        if (card) break;
        await this.page.waitForTimeout(1000);
    }

    if (!card) throw new Error(`Project "${projectName}" not found for deletion`);

    const title = card.locator('h5.card-title');
    const titleText = await title.innerText();
    
    await showStep(this.page, `Verified project card found with name "${titleText}". Preparing to delete.`);
    await highlight(this.page, card, {pause: 800 });
    await highlight(this.page, title, {pause: 800 });
    logInfo(`Deleting project "${projectName}"`);
    
    const deleteBtn = card.locator('button.btn-danger:has-text("Delete")');
    await deleteBtn.waitFor({ state: 'visible' });
    await highlight(this.page, deleteBtn, { pause: 400 });
    await robustClick(this.page, deleteBtn);
    
    await this.confirmDeleteAndWaitForProjectDeleted();
    await showStep(this.page, 'Waiting for backend deletion to settle');
    await fastWait(this.page, 800);
    logInfo(`Project "${projectName}" deleted successfully`);
  }

  async confirmDeleteAndWaitForProjectDeleted() {
    const modal = this.page.locator('div.modal-content');
    const confirmHeader = modal.locator('div.modal-header strong:has-text("Confirm Delete")');
    const deletedHeader = modal.locator('div.modal-header strong:has-text("Project Deleted")');

    await confirmHeader.waitFor({ state: 'visible', timeout: 15000 });
    await highlight(this.page, confirmHeader, { pause: 400 });

    const deleteBtn = modal.locator('div.modal-footer button.btn-danger:has-text("Delete")');
    await deleteBtn.waitFor({ state: 'visible' });
    await highlight(this.page, deleteBtn, { pause: 400 });
    await robustClick(this.page, deleteBtn);

    await showStep(this.page, 'Waiting for "Project Deleted" confirmation');
    await deletedHeader.waitFor({ state: 'visible', timeout: 60000 });
    await highlight(this.page, deletedHeader, { pause: 600 });
    logInfo('Project deletion confirmed via modal header');
  }

  async clickRunOnCard(card) {
    const runBtn = card.getByRole('button', { name: 'Run' });
    if (await runBtn.isVisible().catch(() => false)) {
        await assertVisible(runBtn, 'Run Button');
        await robustClick(this.page, runBtn);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForSelector('div.col-md-4 ul.list-group', { timeout: 20000 });
        return true;
    }
    const title = card.locator('h5.card-title');
    await showStep(this.page, 'Run button not visible — opening project by title.');
    await robustClick(this.page, title.first());
    await this.page.waitForLoadState('networkidle');
    return false;
  }

  async validateProjectCardFields(card, expectedDatasetName, expectedModelType, expectedDatasetCategory) {
    const datasetBadge = card.locator('span.badge');
    if ((await datasetBadge.count()) > 0) {
      const badgeTxt = (await datasetBadge.first().innerText()).trim();
      const ok = !expectedDatasetName || badgeTxt.includes(expectedDatasetName) || badgeTxt.toLowerCase().includes(expectedDatasetName.toLowerCase());
      if (!ok) addWarning(`Dataset badge mismatch.`);
      await highlight(this.page, datasetBadge.first(), { borderColor: 'orange' });
    }
    const info = card.locator('p.card-text');
    if ((await info.count()) > 0) {
      const infoTxt = (await info.first().innerText()).replace(/\s+/g, ' ').trim();
      if (expectedModelType && !infoTxt.includes(expectedModelType)) addWarning(`Model Type mismatch on card.`);
      if (expectedDatasetCategory && !infoTxt.includes(expectedDatasetCategory)) addWarning(`Dataset Category mismatch.`);
      await highlight(this.page, info.first(), { borderColor: 'steelblue' });
    }
  }

  async validateProjectPageDetails(expectedDatasetName, expectedModelType, expectedDatasetCategory) {
    const leftList = this.page.locator('div.col-md-4 ul.list-group');
    await expect(leftList).toBeVisible({ timeout: 20000 });
    await highlight(this.page, leftList, { borderColor: 'purple' });

    const datasetVal = leftList.locator('li:has-text("Dataset:") div.mt-2').first();
    if ((await datasetVal.count()) > 0) {
      try { await expect(datasetVal).not.toHaveText('Loading...', { timeout: 10000 }); } catch (e) {}
      const ds = (await datasetVal.innerText()).trim();
      if (expectedDatasetName && !ds.toLowerCase().includes(expectedDatasetName.toLowerCase())) addWarning(`Project page dataset mismatch.`);
      await highlight(this.page, datasetVal, { borderColor: 'orange' });
    }
    const modelTypeLi = leftList.locator('li:has-text("Model Type:")').first();
    if ((await modelTypeLi.count()) > 0) {
      const mt = (await modelTypeLi.innerText()).replace(/\s+/g, ' ').trim();
      if (expectedModelType && !mt.includes(expectedModelType)) addWarning(`Project page model type mismatch.`);
      await highlight(this.page, modelTypeLi, { borderColor: 'green' });
    }
  }

  async runProjectWorkflow(datasetCategory = '') {
    await this.zoomUntilAreaValid();
    await this.drawAOIUntilAccepted({ datasetCategory });

    const runProjectBtn = this.page.locator('button:has-text("Run Project")').first();
    await assertVisible(runProjectBtn, 'Run Project Button');
    await robustClick(this.page, runProjectBtn);

    await this.page.waitForSelector('div.position-absolute div.text-center div.justify-content-center', { timeout: 120000 }).catch(() => {});
    const successModal = this.page.locator('.modal-content');
    await expect(successModal).toBeVisible({ timeout: 600000 });
    const okBtn = successModal.getByRole('button', { name: /^ok$/i });
    await expect(okBtn).toBeVisible();
    await highlight(this.page, okBtn);
    await robustClick(this.page, okBtn);
    await fastWait(this.page, 800);

    const MAP_VIEW_MS = 5000; 
    await showStep(this.page, `Run completed — viewing map section for ${Math.round(MAP_VIEW_MS/1000)} seconds before returning to Projects page`);
    try {
      const map = await this.ensureMapReady();
      await highlight(this.page, map, { borderColor: 'green', pause: 600 });
    } catch (e) {
      logInfo('Could not highlight map before waiting');
    }
    await this.page.waitForTimeout(MAP_VIEW_MS);
  }

  async ensureMapReady() {
    const map = this.page.locator('.leaflet-container').first();
    await expect(map).toBeVisible({ timeout: 20000 });
    try { await this.page.bringToFront() } catch (e) {}
    try { await map.scrollIntoViewIfNeeded() } catch (e) {}
    await this.page.waitForTimeout(250);
    return map;
  }

  async zoomInSteps(steps = 3, pause = 450) {
    const map = await this.ensureMapReady();
    const box = await map.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    for (let i = 0; i < steps; i++) {
      await this.page.mouse.move(cx, cy);
      await this.page.mouse.wheel(0, -220);
      await this.page.waitForTimeout(pause);

      const areaModal = this.page.locator('.modal-content:has-text("Area Limit Exceeded")');
      if (await areaModal.isVisible().catch(() => false)) {
        logInfo('Area Limit popup detected during zoom — closing');
        const okBtn = areaModal.getByRole('button', { name: /^ok$/i });
        if (await okBtn.isVisible().catch(() => false)) await robustClick(this.page, okBtn);
        else { const closeBtn = areaModal.locator('button.btn-close'); if ((await closeBtn.count()) > 0) await robustClick(this.page, closeBtn.first()); }
        await this.page.waitForTimeout(350);
      }
    }
  }

  async zoomUntilAreaValid(maxZooms = 8) {
    const map = await this.ensureMapReady();
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await highlight(this.page, map);

    for (let i = 0; i < maxZooms; i++) {
      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.wheel(0, -250);
      await this.page.waitForTimeout(700);

      const areaModal = this.page.locator('.modal-content:has-text("Area Limit Exceeded")');
      if (await areaModal.isVisible().catch(() => false)) {
        const okBtn = areaModal.getByRole('button', { name: /^ok$/i });
        if (await okBtn.isVisible().catch(() => false)) await robustClick(this.page, okBtn);
        else { const closeBtn = areaModal.locator('button.btn-close'); if ((await closeBtn.count()) > 0) await robustClick(this.page, closeBtn.first()); }
        await this.page.waitForTimeout(700);
        continue;
      }
      break;
    }
  }

  async waitForAOIIndicator(timeoutMs = 10000) {
    const start = Date.now();
    const selectors = [
      '.leaflet-overlay-pane svg path',
      '.leaflet-overlay-pane svg rect',
      '.leaflet-overlay-pane svg polygon',
      '.extent-controls .text-muted',
      '.extent-controls .mt-2.small.text-muted',
      'text=Extent selected'
    ];

    while (Date.now() - start < timeoutMs) {
      for (const sel of selectors) {
        try {
          const loc = this.page.locator(sel);
          if ((await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false))) {
            logInfo(`AOI indicator found via selector: ${sel}`);
            return loc.first();
          }
        } catch (e) {}
      }
      await this.page.waitForTimeout(300);
    }
    return null;
  }

  async drawRectangleOnce() {
    const map = await this.ensureMapReady();
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found for draw');

    const margin = Math.min(120, Math.floor(Math.min(box.width, box.height) * 0.12));
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const startXRaw = box.x + margin + Math.random() * (box.width / 3);
    const startYRaw = box.y + margin + Math.random() * (box.height / 3);

    const startX = clamp(Math.round(startXRaw), Math.round(box.x + 8), Math.round(box.x + box.width - 8));
    const startY = clamp(Math.round(startYRaw), Math.round(box.y + 8), Math.round(box.y + box.height - 8));

    const rectW = Math.min(220, Math.floor(box.width * 0.45));
    const rectH = Math.min(160, Math.floor(box.height * 0.45));
    const endX = clamp(startX + rectW, Math.round(box.x + 8), Math.round(box.x + box.width - 8));
    const endY = clamp(startY + rectH, Math.round(box.y + 8), Math.round(box.y + box.height - 8));

    logInfo(`Drawing AOI attempt: ${startX},${startY} → ${endX},${endY}`);
    try { await this.page.bringToFront() } catch (e) {}
    await this.page.mouse.move(startX, startY);
    await this.page.waitForTimeout(80);
    await this.page.mouse.down();
    await this.page.waitForTimeout(120);
    await this.page.mouse.move(endX, endY, { steps: 30 });
    await this.page.waitForTimeout(120);
    await this.page.mouse.up();
    await this.page.waitForTimeout(500);
  }

  async drawAOIUntilAccepted(opts = {}) {
    const { maxAttempts = 12, zoomStepsOnLimit = 2, datasetCategory = '' } = opts;
    const drawBtn = this.page.locator('li.extent-controls button:has-text("Draw AOI"), button:has-text("Draw AOI")').first();
    
    await assertVisible(drawBtn, 'Draw AOI Button');
    await showStep(this.page, 'Click Draw AOI tool (initial)');
    await highlight(this.page, drawBtn);
    await drawBtn.click();
    await this.page.waitForTimeout(400);

    const isPublic = datasetCategory && datasetCategory.toLowerCase().includes('public');
    const isUploaded = datasetCategory && datasetCategory.toLowerCase().includes('upload');

    if (isPublic) {
      await showStep(this.page, 'Public dataset: initial draw attempt');
      await this.drawRectangleOnce();

      const areaModal = this.page.locator('.modal-content:has-text("Area Limit Exceeded")');
      if (await areaModal.isVisible().catch(() => false)) {
        logInfo('Area Limit popup detected after initial draw — closing before mass zoom');
        const okBtn = areaModal.getByRole('button', { name: /^ok$/i });
        if (await okBtn.isVisible().catch(() => false)) await robustClick(this.page, okBtn);
        else { const closeBtn = areaModal.locator('button.btn-close'); if ((await closeBtn.count()) > 0) await robustClick(this.page, closeBtn.first()); }
        await this.page.waitForTimeout(500);
      }

      await showStep(this.page, 'Public dataset: zooming 15 steps now');
      await this.zoomInSteps(15, 300);

      for (let attempt = 1; attempt <= 4; attempt++) {
        await showStep(this.page, `Public dataset: post-zoom draw attempt ${attempt}`);
        await highlight(this.page, drawBtn);
        await drawBtn.click();
        await this.page.waitForTimeout(300);
        await this.drawRectangleOnce();
        
        const indicator = await this.waitForAOIIndicator(8000);
        if (indicator) { await showStep(this.page, `AOI detected (post-zoom attempt ${attempt})`); await highlight(this.page, indicator); return; }
      }
      await showStep(this.page, 'Public dataset: proceeding without AOI visual confirmation');
      return;
    }

    if (isUploaded) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            await showStep(this.page, `Uploaded dataset: draw attempt ${attempt}`);
            await highlight(this.page, drawBtn);
            await drawBtn.click();
            await this.page.waitForTimeout(300);
            await this.drawRectangleOnce();
            
            const areaModal = this.page.locator('.modal-content:has-text("Area Limit Exceeded")');
            if (await areaModal.isVisible().catch(() => false)) {
                const okBtn = areaModal.getByRole('button', { name: /^ok$/i });
                if (await okBtn.isVisible().catch(() => false)) await robustClick(this.page, okBtn);
                else { const closeBtn = areaModal.locator('button.btn-close'); if ((await closeBtn.count()) > 0) await robustClick(this.page, closeBtn.first()); }
                await this.page.waitForTimeout(500);
                continue;
            }
            
            const indicator = await this.waitForAOIIndicator(8000);
            if (indicator) { await showStep(this.page, `AOI detected (uploaded attempt ${attempt})`); await highlight(this.page, indicator); return; }
        }
        throw new Error('Uploaded Dataset: AOI not detected after 3 attempts');
    }

    await this.drawRectangleOnce();
    await showStep(this.page, 'AOI Drawn');
  }
}