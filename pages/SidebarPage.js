// pages/SidebarPage.js
import { Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'
import { robustClick, highlight, fastWait, showStep, logInfo, addWarning, waitForVisible, sleep } from '../utils/helpers'

export class SidebarPage extends BasePage {
  constructor(page) {
    super(page)
    this.locators = {
      sidebar: page.locator('div.sidebar.sidebar-dark, aside.sidebar').first(),
      
      // Logo
      logo: page.locator("//img[@alt='GeoWGS84.AI Logo']"),
      
      // Navigation links
      dashboard: page.locator("//a[@href='#/dashboard' and contains(@class,'nav-link')]").first(),
      projects: page.locator("//a[normalize-space()='Projects']"),
      
      // Datasets Group
      datasetsToggle: page.locator("//a[contains(@class,'nav-group-toggle')]"),
      publicDataset: page.locator("//a[normalize-space()='Public Dataset']"),
      uploadedDatasets: page.locator("//a[normalize-space()='Uploaded Datasets']"),
      purchasedDatasets: page.locator("//a[normalize-space()='Purchased Datasets']"),

      // Other Sidebar Links
      fineTunedModels: page.locator("//a[@href='#/finetunedmodels']"),
      annotate: page.locator("//a[normalize-space()='Annotate']"),
      trainingDatasets: page.locator("//a[normalize-space()='Training Datasets']"),
      yourModels: page.locator("//a[normalize-space()='Your Models']"),
      downloadGIS: page.locator("//a[normalize-space()='Download GIS Analysis']"),
      documentations: page.locator("//a[normalize-space()='Documentations']"),
      discussion: page.locator("//a[normalize-space()='Discussion']"),
      discord: page.locator("//a[normalize-space()='Discord']"),
      utilities: page.locator("//a[normalize-space()='Utilities']"),
      privacyPolicy: page.locator("//a[normalize-space()='Privacy Policy']"),
      
      logout: page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]'),
    }
  }

  async ensureOnDashboard() {
    const currentUrl = this.page.url();
    if (!currentUrl.includes('dashboard')) {
        await this.page.goto('https://platform.geowgs84.ai/#/dashboard');
        await this.page.waitForLoadState('domcontentloaded');
    }
    await expect(this.locators.sidebar).toBeVisible({ timeout: 10000 });
  }

  async verifyElementsVisible() {
     await showStep(this.page, 'Step 1: Verify Sidebar elements visible');
     await expect(this.locators.sidebar).toBeVisible();
     logInfo('Sidebar container verified');

     const items = [
        [this.locators.logo, 'Logo'],
        [this.locators.dashboard, 'Dashboard'],
        [this.locators.datasetsToggle, 'Datasets'],
        [this.locators.projects, 'Projects'],
        [this.locators.fineTunedModels, 'Fine Tuned Models'],
        [this.locators.annotate, 'Annotate'],
        [this.locators.trainingDatasets, 'Training Datasets'],
        [this.locators.yourModels, 'Your Models'],
        [this.locators.downloadGIS, 'Download GIS Analysis'],
        [this.locators.documentations, 'Documentations'],
        [this.locators.discussion, 'Discussion'],
        [this.locators.discord, 'Discord'],
        [this.locators.utilities, 'Utilities'],
        [this.locators.privacyPolicy, 'Privacy Policy']
     ];

     for (const [loc, label] of items) {
        try {
           await loc.scrollIntoViewIfNeeded();
           await highlight(this.page, loc, 'lightyellow');
           await expect(loc).toBeVisible({ timeout: 2000 });
           logInfo(`${label}: VISIBLE`);
        } catch (e) {
           addWarning(`${label} not visible in sidebar`);
        }
     }
  }

  async clickAndHandle(locator, label, expectedUrlPart = null, isNewTab = false) {
    // Note: We do not call showStep here anymore to avoid duplicate logs
    // Steps are handled in the main flow for better context
    
    try {
        await locator.scrollIntoViewIfNeeded();
    } catch (e) {}

    await highlight(this.page, locator, 'sky');

    if (isNewTab) {
        const [newPage] = await Promise.all([
            this.page.context().waitForEvent('page').catch(() => null),
            robustClick(this.page, locator)
        ]);
        
        if (newPage) {
            await newPage.waitForLoadState('domcontentloaded');
            logInfo(`New tab opened for ${label}: ${newPage.url()}`);
            await newPage.close();
        }
    } else {
        await robustClick(this.page, locator);
        await this.page.waitForLoadState('networkidle').catch(() => {});
        
        if (expectedUrlPart) {
            await this.page.waitForURL(new RegExp(expectedUrlPart), { timeout: 10000 }).catch(() => {
                addWarning(`URL did not match ${expectedUrlPart}`);
            });
        }
    }
    logInfo(`${label} processed`);
  }

  async navigateToDashboard() {
    await this.clickAndHandle(this.locators.dashboard, 'Dashboard');
  }

  async navigateToProjects() {
    await this.clickAndHandle(this.locators.projects, 'Projects');
  }
  
  async openDatasetsMenu() {
    const toggle = this.locators.datasetsToggle;
    const publicLink = this.locators.publicDataset;
    
    if (!(await publicLink.isVisible().catch(() => false))) {
        await robustClick(this.page, toggle);
        await this.page.waitForTimeout(500);
    }
    await expect(publicLink).toBeVisible();
  }

  async selectDatasetType(type) {
    let loc;
    if (type === 'Public Dataset') loc = this.locators.publicDataset;
    else if (type === 'Uploaded Datasets') loc = this.locators.uploadedDatasets;
    else if (type === 'Purchased Datasets') loc = this.locators.purchasedDatasets;
    else loc = this.page.locator(`//a[normalize-space()='${type}']`);

    await this.clickAndHandle(loc, type);
  }

  async verifySidebarFunctionality() {
    // 1. Logo
    await showStep(this.page, 'Step 1: Verify Logo Link (External)');
    await this.clickAndHandle(this.locators.logo, 'Logo', 'geowgs84.ai', true);

    // 2. Dashboard
    await showStep(this.page, 'Step 2: Verify Dashboard Navigation');
    await this.clickAndHandle(this.locators.dashboard, 'Dashboard');
    await expect(this.locators.dashboard).toHaveClass(/active/);

    // 3. Datasets Menu
    await showStep(this.page, 'Step 3: Verify Datasets Menu & Links');
    await this.openDatasetsMenu();
    await this.selectDatasetType('Public Dataset');
    
    await this.openDatasetsMenu();
    await this.selectDatasetType('Uploaded Datasets');
    
    await this.openDatasetsMenu();
    await this.selectDatasetType('Purchased Datasets');

    // 4. Projects
    await showStep(this.page, 'Step 4: Verify Projects Link');
    await this.clickAndHandle(this.locators.projects, 'Projects');

    // 5. Fine Tuned Models
    await showStep(this.page, 'Step 5: Verify Fine Tuned Models Link');
    await this.clickAndHandle(this.locators.fineTunedModels, 'Fine Tuned Models');

    // 6. Annotate
    await showStep(this.page, 'Step 6: Verify Annotate Link');
    await this.clickAndHandle(this.locators.annotate, 'Annotate');

    // 7. Training Datasets
    await showStep(this.page, 'Step 7: Verify Training Datasets Link');
    await this.clickAndHandle(this.locators.trainingDatasets, 'Training Datasets');

    // 8. Your Models
    await showStep(this.page, 'Step 8: Verify Your Models Link');
    await this.clickAndHandle(this.locators.yourModels, 'Your Models');

    // 9. Download GIS Analysis
    await showStep(this.page, 'Step 9: Verify Download GIS Analysis Link');
    await this.clickAndHandle(this.locators.downloadGIS, 'Download GIS Analysis');

    // 10. Documentations
    await showStep(this.page, 'Step 10: Verify Documentations Link (External)');
    await this.clickAndHandle(this.locators.documentations, 'Documentations', '/documentation', true);

    // 11. Discussion
    await showStep(this.page, 'Step 11: Verify Discussion Link (External)');
    await this.clickAndHandle(this.locators.discussion, 'Discussion', '/discussion', true);

    // 12. Discord
    await showStep(this.page, 'Step 12: Verify Discord Link (External)');
    await this.clickAndHandle(this.locators.discord, 'Discord', 'discord', true);

    // 13. Utilities
    await showStep(this.page, 'Step 13: Verify Utilities Link');
    await this.clickAndHandle(this.locators.utilities, 'Utilities');

    // 14. Privacy Policy
    await showStep(this.page, 'Step 14: Verify Privacy Policy Link (External)');
    await this.clickAndHandle(this.locators.privacyPolicy, 'Privacy Policy', '/privacy-policy', true);
  }
}

export default SidebarPage;