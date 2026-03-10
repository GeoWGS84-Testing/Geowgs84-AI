// tests/s_navbar.spec.js
import { test, expect } from './common';
import { SidebarPage } from '../pages/SidebarPage';

test.setTimeout(600000);


test('[P1] TC-1: Verify Sidebar elements', async ({ page }) => {
  const sidebarPage = new SidebarPage(page);
  
  // FIX: Ensure we are on the dashboard
  await sidebarPage.ensureOnDashboard();
  
  await sidebarPage.verifySidebarFunctionality();
});