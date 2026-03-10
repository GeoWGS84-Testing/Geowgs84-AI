import { test, expect } from './common';
import { UpperNavbarPage } from '../pages/UpperNavbarPage';
import { showStep } from '../utils/helpers';

test.setTimeout(600000);

test('[P1] TC-1: Click and view Upper Navbar', async ({ page }) => {
  const upperNav = new UpperNavbarPage(page);

  await upperNav.ensurePageLoaded();

  await showStep(page, 'Step 2: Verify Sidebar Toggle Works');
  await upperNav.verifySidebarToggleWorks();

  await showStep(page, 'Step 3: Verify Users Navigation');
  await upperNav.navigateToUsers();
  await upperNav.navigateToDashboard(); // Navigate back once to continue flow

  await showStep(page, 'Step 4: Verify Enhancement Request Link');
  await upperNav.openEnhancementRequest();

  await showStep(page, 'Step 5: Verify Billing Services Link');
  await upperNav.navigateToBilling();

  await showStep(page, 'Step 6: Verify Updates Link');
  await upperNav.navigateToUpdates();

  await showStep(page, 'Step 7: Verify Color Mode Toggle');
  await upperNav.cycleColorModes();

  await showStep(page, 'Step 8: Verify Account and Settings Dropdown Links');
  
  await upperNav.navigateFromDropdown('Profile', 'profile');
  await upperNav.navigateFromDropdown('Updates', 'updates');
  await upperNav.navigateFromDropdown('Payments', 'transactions');

  await showStep(page, 'Step 9: Verify Delete Profile Modal & Cancel');
  await upperNav.clickDeleteProfile();

  // 10. Logout
  await showStep(page, 'Step 10: Verify Logout');
  await upperNav.clickLogout();
});