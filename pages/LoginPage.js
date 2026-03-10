//pages\LoginPage.js
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { logInfo } from '../utils/helpers';

export class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.locator("button[type='submit']");
  }

  async goto() {
    const loginUrl = process.env.LOGIN_URL || 'https://platform.geowgs84.ai/#/login';
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/login/i);
    logInfo('Navigated to login page');
  }

  async verifyFormLoaded() {
    await this.showStep('Verify Login Form Loaded');
    await this.assertVisible(this.emailInput, 'Login email input');
  }

  async performLogin(email, password) {
    await this.showStep('Step 1: Enter Credentials & Login');
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);

    await this.showStep('Step 2: Click Login Button');
    await this.robustClick(this.loginButton);

    // Wait for navigation
    await this.page.waitForLoadState('domcontentloaded');
    logInfo('Login submitted');
  }
}