// tests/dashboard.spec.js
import { test, expect, showSmallFailureBanner } from './common';
import { DashboardPage } from '../pages/DashboardPage';

test.setTimeout(600000);

test('[P0] TC-1: Verify all 4 dashboard cards are present', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.showStep('Starting Test');
  await dashboard.goto(); 

  await dashboard.showStep('Step 1: Verify Dashboard Cards');
  await dashboard.verifyDashboardCards();
});

test('[P1] TC-2: Verify Storage Usage & GPU Credit Usage containers are present', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.showStep('Step 1: Verify Storage & GPU Cards');
  await dashboard.verifyStorageAndGPU();
});

test('[P1] TC-3: Verify System Status section and all cards are present', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.showStep('Step 1: Verify System Status Section');
  // This now correctly checks for All Systems Up, Uptime, Overall Uptime, and Status Updates
  await dashboard.verifySystemStatusSection();
});

test('[P2] TC-4: Verify Social Cards section and click interactions', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.showStep('Step 1: Verify Social Cards');
  await dashboard.verifySocialCards();
});

test('[P1] TC-05: Verify Most Used Fine-Tuned Models section', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.showStep('Step 1: Verify Most Used Fine-Tuned Models');
  await dashboard.verifyMostUsedFineTunedModels();
});