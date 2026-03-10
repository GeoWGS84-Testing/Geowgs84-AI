// tests/auth.setup.js
import 'dotenv/config';
import { test as setup, expect } from './common'; 
import { LoginPage } from '../pages/LoginPage';
import { setContext, logInfo, highlight, clearDiagnosticsFolder  } from '../utils/helpers';
import fs from 'fs';

const authFile = '.auth/user.json';

setup('authenticate', async ({ page, context }) => {
  clearDiagnosticsFolder(); 

  setContext({ testcase: 'Authentication Setup' });

  // 1. Check if auth file exists and load cookies
  if (fs.existsSync(authFile)) {
    logInfo('Auth file exists. Adding cookies to context...');
    try {
      const storedState = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      await context.addCookies(storedState.cookies || []);
    } catch (e) {
      logInfo('Failed to parse auth file, proceeding with fresh login.');
    }
  }

  const loginPage = new LoginPage(page);
  
  // FIX: Provide fallback and correct URL construction for SPA
  const baseUrl = process.env.BASE_URL || 'https://platform.geowgs84.ai';
  const dashboardUrl = `${baseUrl}/#/dashboard`;

  logInfo(`Navigating to ${dashboardUrl} to check session...`);
  
  // 2. Try to go to Dashboard directly
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });

  // 3. Check if we were redirected to Login or stayed on Dashboard
  await page.waitForTimeout(2000); 
  
  const currentUrl = page.url();

  if (!currentUrl.includes('login') && !currentUrl.includes('signin')) {
     // Verify a dashboard element to ensure we are actually logged in
     const dashboardCard = page.locator('div.card:has-text("Upload GIS Data")');
     try {
        await dashboardCard.waitFor({ state: 'visible', timeout: 5000 });
        logInfo('Valid session found. Skipping login process.');
        // Ensure state is saved
        await page.context().storageState({ path: authFile });
        return; 
     } catch (e) {
        logInfo('Session invalid (element not found). Proceeding to login.');
     }
  }

  // 4. If we are here, we need to log in
  logInfo('Proceeding to fresh login.');
  
  // Navigate explicitly to login page
  await loginPage.goto();
  await loginPage.verifyFormLoaded();

  const email = process.env.USER_EMAIL;
  const password = process.env.USER_PASSWORD;

  if (!email || !password) {
    throw new Error('USER_EMAIL and USER_PASSWORD must be set in .env');
  }

  await loginPage.performLogin(email, password);

  // Wait for dashboard URL explicitly
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  await expect(page).toHaveURL(/dashboard/i);
  
  logInfo('Login successful, saving state');
  await page.context().storageState({ path: authFile });
  logInfo('Authentication state saved');
});