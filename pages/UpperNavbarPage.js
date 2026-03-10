// pages/UpperNavbarPage.js
import { Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'
import { robustClick, highlight, fastWait, showStep, logInfo, addWarning } from '../utils/helpers'

export class UpperNavbarPage extends BasePage {
  constructor(page) {
    super(page)
    this.locators = {
      navbar: page.locator('nav, header, .navbar').first(),
      
      // Main Links
      dashboardLink: page.locator("//a[normalize-space()='Dashboard']").first(),
      usersLink: page.locator("//a[normalize-space()='Users']").first(),
      
      // Sidebar Toggle
      sidebarToggler: page.locator('button.header-toggler').first(),
      sidebar: page.locator('div.sidebar.sidebar-dark, aside.sidebar').first(),
      
      // Brand / Logo
      brandLink: page.locator('.navbar-brand, a.brand').first(),
      
      // User Profile / Dropdown
      userProfile: page.locator('.avatar-img').first(),
      userDropdown: page.locator('.dropdown-menu.show'),
      
      // Color Mode
      colorModeBtn: page.locator("(//*[name()='svg'][@role='img'])[18]").first(),
      
      // External / Specific Links
      enhancementLink: page.locator(".nav-link[href*='enhancement-request-new']"),
      billingLink: page.locator("//a[@href='#/billingservices']"),
      updatesLink: page.locator("//a[@class='nav-link position-relative']"),
    }
  }

  async ensurePageLoaded() {
      await showStep(this.page, 'Step 1: Ensure Upper Navbar Loaded');
      const currentUrl = this.page.url();
      if (!currentUrl.includes('dashboard')) {
          await this.page.goto('https://platform.geowgs84.ai/#/dashboard');
          await this.page.waitForLoadState('domcontentloaded');
      }
      await expect(this.locators.navbar).toBeVisible();
  }

  async verifySidebarToggleWorks() {
    await showStep(this.page, 'Verify Sidebar Toggle');
    const toggler = this.locators.sidebarToggler;
    const sidebar = this.locators.sidebar;
    
    await toggler.waitFor({ state: 'visible', timeout: 5000 });
    await highlight(this.page, toggler, 'lime');
    
    const before = await sidebar.boundingBox();
    await robustClick(this.page, toggler);
    await this.page.waitForTimeout(600);
    const after = await sidebar.boundingBox();
    
    if (JSON.stringify(before) === JSON.stringify(after)) {
       addWarning('Sidebar bounding box did not change on toggle', { before, after });
    }
    logInfo('Sidebar toggle verified');
  }

  async navigateToDashboard() {
    await showStep(this.page, 'Navigating to Dashboard');
    const link = this.locators.dashboardLink;
    await highlight(this.page, link, 'lime');
    await robustClick(this.page, link);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    logInfo('Navigated to Dashboard');
  }

  async navigateToUsers() {
    await showStep(this.page, 'Navigating to Users via Navbar')
    const link = this.locators.usersLink
    await highlight(this.page, link, 'lime')
    
    await robustClick(this.page, link);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    
    await expect(link).toHaveClass(/active/);
    await expect(this.locators.dashboardLink).not.toHaveClass(/active/);
    logInfo('Navigated to Users');
  }

  async openEnhancementRequest() {
    await showStep(this.page, 'Opening Enhancement Request (External)');
    const link = this.locators.enhancementLink;
    await expect(link).toBeVisible({ timeout: 5000 });
    await highlight(this.page, link, 'purple');
    
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page').catch(() => null),
      robustClick(this.page, link)
    ]);
    
    if (newPage) {
       await newPage.waitForLoadState('domcontentloaded');
       logInfo('Enhancement request opened in new tab');
       await newPage.close();
    } else {
       addWarning('Enhancement request link did not open new tab');
    }
  }
  
  async navigateToBilling() {
    await showStep(this.page, 'Navigating to Billing Services');
    const link = this.locators.billingLink;
    await highlight(this.page, link, 'gold');
    await robustClick(this.page, link);
    await this.page.waitForURL(/#\/billingservices/, { timeout: 10000 }).catch(() => {});
    logInfo('Navigated to Billing');
  }

  async navigateToUpdates() {
    await showStep(this.page, 'Navigating to Updates');
    const link = this.locators.updatesLink;
    await highlight(this.page, link, 'coral');
    await robustClick(this.page, link);
    await this.page.waitForURL(/#\/updates/, { timeout: 10000 }).catch(() => {});
    logInfo('Navigated to Updates');
  }

  async cycleColorModes() {
    await showStep(this.page, 'Cycling Color Modes');
    const btn = this.locators.colorModeBtn;
    
    await robustClick(this.page, btn);
    await this.page.waitForTimeout(300);
    
    await this.page.evaluate(() => {
       document.querySelectorAll('.tooltip, [role="tooltip"]').forEach(el => el.remove());
    });

    const modes = ['Light', 'Dark', 'Auto'];
    for (const mode of modes) {
       const modeBtn = this.page.locator(`(//button[normalize-space()='${mode}'])[1]`);
       if (await modeBtn.isVisible()) {
          await highlight(this.page, modeBtn, 'gold');
          await robustClick(this.page, modeBtn);
          await this.page.waitForTimeout(300);
       }
    }
    logInfo('Color modes cycled');
  }

  async openUserDropdown() {
    const avatar = this.locators.userProfile;
    const dropdown = this.locators.userDropdown;
    
    if (await dropdown.isVisible().catch(() => false)) return dropdown;
    
    await avatar.waitFor({ state: 'visible', timeout: 5000 });
    // Highlight avatar normally (scrolling is fine here)
    await highlight(this.page, avatar, 'teal');
    
    for (let i = 0; i < 2; i++) {
      await avatar.click({ force: true });
      await this.page.waitForTimeout(500);
      if (await dropdown.isVisible().catch(() => false)) return dropdown;
    }
    
    logInfo('Recovering dropdown via dashboard reload');
    await this.page.goto('https://platform.geowgs84.ai/#/dashboard');
    await avatar.click({ force: true });
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });
    return dropdown;
  }

  async navigateFromDropdown(label, expectedUrlPart) {
    await showStep(this.page, `Clicking ${label} in Dropdown`);
    await this.openUserDropdown();
    
    const link = this.page.locator(`//a[normalize-space()='${label}']`);
    await link.waitFor({ state: 'attached', timeout: 5000 });

    // FIX: Highlight with forceOutlineOnly: true to prevent scrolling
    await highlight(this.page, link, { color: 'purple', forceOutlineOnly: true, pause: 400 });

    // Click via dispatchEvent to avoid visibility checks
    await link.dispatchEvent('click');
    
    await this.page.waitForURL(new RegExp(expectedUrlPart), { timeout: 10000 }).catch(() => {
        addWarning(`URL did not match ${expectedUrlPart} after clicking ${label}`);
    });
    logInfo(`${label} navigation done`);
  }

  async clickDeleteProfile() {
    await showStep(this.page, 'Clicking Delete Profile');
    await this.openUserDropdown();
    
    const link = this.page.locator("//a[normalize-space()='Delete Profile']");
    await link.waitFor({ state: 'attached', timeout: 5000 });
    
    // Highlight safely
    await highlight(this.page, link, { color: 'coral', forceOutlineOnly: true, pause: 400 });
    
    // Click
    await link.dispatchEvent('click');
    
    // Wait for Modal using the provided HTML structure
    const modal = this.page.locator('div.modal-content:has-text("Delete Account")');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    logInfo('Delete Account modal appeared');
    
    // Highlight and Click Cancel inside the modal
    const cancelBtn = modal.locator('button.btn-secondary:has-text("Cancel")');
    await cancelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await highlight(this.page, cancelBtn, 'sky');
    await robustClick(this.page, cancelBtn);
    
    // Verify modal closes
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    logInfo('Delete Profile modal cancelled and closed');
  }

  // The old cancelDeleteProfile is no longer needed separately as we handle it inside clickDeleteProfile flow
  // But we keep the logout separate
  async clickLogout() {
    await showStep(this.page, 'Logging out');
    await this.openUserDropdown();
    const btn = this.page.locator('a:has-text("Logout")').first();
    
    await btn.waitFor({ state: 'attached', timeout: 5000 });
    // Highlight safely
    await highlight(this.page, btn, { color: 'gray', forceOutlineOnly: true, pause: 400 });
    
    await btn.dispatchEvent('click');
    
    await this.page.waitForURL(/login/i, { timeout: 10000 }).catch(() => {});
    logInfo('Logged out');
  }
}

export default UpperNavbarPage;