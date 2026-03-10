// tests/datasets.spec.js
import { test, expect } from './common';
import { DashboardPage } from '../pages/DashboardPage';
import { DatasetsPage } from '../pages/DatasetsPage';
import { logInfo, showStep, highlight, robustClick, getInnerTextSafe } from '../utils/helpers';

test.setTimeout(600000);

test('[P1] TC-01: Public Dataset WMS/WCS/Detail', async ({ page, context }) => {
  const dashboard = new DashboardPage(page);
  const datasetsPage = new DatasetsPage(page);

  // 1. Initialize Dashboard
  await showStep(page, 'Step 1: Initialize Dashboard');
  await dashboard.goto();

  // 2. Open Datasets Menu
  await showStep(page, 'Step 2: Open Datasets menu');
  await datasetsPage.openDatasetsMenu();

  // 3. Navigate to Public Datasets
  await showStep(page, 'Step 3: Open Public Dataset');
  await datasetsPage.gotoPublicDatasets();

  // 4. Process Table
  const table = page.locator('.card-body table');
  await showStep(page, 'Step 4: Process Public Datasets table');
  
  await datasetsPage.processTableRows(table, async (row, idx, name) => {
    await showStep(page, `Step 5.${idx + 1}: Process Row - ${name}`);
    
    // Click Name
    const nameCell = row.locator('td').nth(1);
    await robustClick(page, nameCell);
    logInfo(`Dataset name clicked: ${name}`);

    // WMS
    const wms = row.getByRole('link', { name: 'View WMS' });
    if (await wms.count() > 0) {
      await showStep(page, `Step 5.${idx + 1}.a: Open WMS for ${name}`);
      await datasetsPage.openAndCloseNewPageFromClick(() => robustClick(page, wms), 'WMS');
    }

    // WCS
    const wcs = row.getByRole('link', { name: 'View WCS' });
    if (await wcs.count() > 0) {
      await showStep(page, `Step 5.${idx + 1}.b: Open WCS for ${name}`);
      await datasetsPage.openAndCloseNewPageFromClick(() => robustClick(page, wcs), 'WCS');
    }

    // View Detail
    const detail = row.getByRole('link', { name: 'View Detail' });
    if (await detail.count() > 0) {
      await showStep(page, `Step 5.${idx + 1}.c: Open Detail for ${name}`);
      await datasetsPage.openAndCloseNewPageFromClick(() => robustClick(page, detail), 'Detail');
    }
  });

  await showStep(page, 'Step 6: Test Completed');
  logInfo('✓Testcase 1 Completed');
});

test('[P1] TC-02: Uploaded Datasets Publish/View', async ({ page, context }) => {
  const dashboard = new DashboardPage(page);
  const datasetsPage = new DatasetsPage(page);

  // 1. Initialize Dashboard
  await showStep(page, 'Step 1: Initialize Dashboard');
  await dashboard.goto();

  // 2. Open Datasets Menu
  await showStep(page, 'Step 2: Open Datasets menu');
  await datasetsPage.openDatasetsMenu();

  // 3. Navigate to Uploaded Datasets
  await showStep(page, 'Step 3: Open Uploaded Datasets');
  await datasetsPage.gotoUploadedDatasets();

  // 4. Process Table
  const table = page.locator('table');
  await showStep(page, 'Step 4: Process Uploaded Datasets table');

  await datasetsPage.processTableRows(table, async (row, idx, name) => {
    await showStep(page, `Step 5.${idx + 1}: Process Row - ${name}`);

    // Check 2nd cell
    const secondCell = row.locator('td').nth(1);
    if (await secondCell.count() > 0 && (await getInnerTextSafe(secondCell)).trim()) {
      await robustClick(page, secondCell);
      logInfo(`Dataset name clicked: ${name}`);
    }

    // Logic for Publish vs View
    const col9Btn = row.locator('td').nth(8).locator('button').first();
    
    if (await col9Btn.count() > 0) {
      const viewBtn = await datasetsPage.clickActionAndWaitForView(row, col9Btn);

      if (viewBtn) {
        await showStep(page, `Step 5.${idx + 1}.a: Click View for ${name}`);
        await robustClick(page, viewBtn);
        logInfo('GIS View clicked');
        
        const closeView = page.locator('div.modal-footer button.btn-secondary');
        await datasetsPage.handleModalClose(closeView);

        const wms = row.locator('td').nth(6).locator('button').first();
        if (await wms.count() > 0) {
          await showStep(page, `Step 5.${idx + 1}.b: Click WMS`);
          await robustClick(page, wms);
          logInfo('WMS clicked');
          const closeWms = page.locator('div.modal-content button.btn-secondary');
          await datasetsPage.handleModalClose(closeWms);
        }

        const wcs = row.locator('td').nth(7).locator('button').first();
        if (await wcs.count() > 0) {
          await showStep(page, `Step 5.${idx + 1}.c: Click WCS`);
          await robustClick(page, wcs);
          logInfo('WCS clicked');
          const closeWcs = page.locator('div.modal-content button.btn-secondary');
          await datasetsPage.handleModalClose(closeWcs);
        }
      }
    }

    // Delete Button
    const delBtn = row.locator('td').nth(9).locator('button').first();
    if (await delBtn.count() > 0) {
      await showStep(page, `Step 5.${idx + 1}.d: Cancel Delete for ${name}`);
      await robustClick(page, delBtn);
      logInfo(`Delete clicked for ${name}`);
      
      const cancelBtn = page.locator('button.swal2-cancel');
      await datasetsPage.handleModalClose(cancelBtn);
      logInfo('Delete cancelled');
    }
  });

  await showStep(page, 'Step 6: Test Completed');
  logInfo('✓Testcase 2 Completed');
});

test('[P1] TC-03: Verify Purchased Datasets flow and Purchase navigation', async ({ page, context }) => {
  const dashboard = new DashboardPage(page);
  const datasetsPage = new DatasetsPage(page);

  // 1. Initialize Dashboard
  await showStep(page, 'Step 1: Initialize Dashboard');
  await dashboard.goto();

  // 2. Open Datasets Menu
  await showStep(page, 'Step 2: Open Datasets menu');
  await datasetsPage.openDatasetsMenu();

  // 3. Navigate to Purchased Datasets
  await showStep(page, 'Step 3: Open Purchased Datasets');
  await datasetsPage.gotoPurchasedDatasets();

  // 4. Verify Heading
  await showStep(page, 'Step 4: Verify Heading');
  const purchasedHeading = page.getByRole('heading', { name: 'Your Purchased Datasets' });
  await highlight(page, purchasedHeading);
  await expect(purchasedHeading).toBeVisible();

  // 5. Check Empty State
  await showStep(page, 'Step 5: Check Empty State');
  const table = page.locator('table.table-striped');
  await highlight(page, table);
  
  const noDataMessage = table.getByText('No non-premium datasets available');
  if (await noDataMessage.isVisible()) {
    await highlight(page, noDataMessage);
    logInfo('No purchased datasets available (expected state)');
  }

  // 6. Purchase New Dataset Navigation
  await showStep(page, 'Step 6: Click Purchase New Dataset');
  const purchaseNewBtn = page.getByRole('button', { name: 'Purchase New Dataset' });
  await robustClick(page, purchaseNewBtn);

  await showStep(page, 'Step 7: Verify Purchase GIS Data page');
  await expect(page).toHaveURL(/#\/PurchaseGISData/i);
  const purchasePageHeading = page.getByRole('heading', { name: /Purchase or View Purchased GIS Data/i });
  await highlight(page, purchasePageHeading);

  // 8. Purchase Data Button
  await showStep(page, 'Step 8: Open Purchase Data in new tab');
  const purchaseDataBtn = page.getByRole('button', { name: 'Purchase Data' });
  await datasetsPage.openAndCloseNewPageFromClick(() => robustClick(page, purchaseDataBtn), 'Purchase Data');

  // 9. Purchased Data Button
  await showStep(page, 'Step 9: Click Purchased Data card');
  const purchasedDataBtn = page.getByRole('button', { name: 'Purchased Data' });
  await robustClick(page, purchasedDataBtn);

  // 10. Validate Alert
  await showStep(page, 'Step 10: Validate "No purchased data available" message');
  const noPurchasedDataAlert = page.locator('.alert.alert-info', { hasText: 'No purchased data available' });
  await highlight(page, noPurchasedDataAlert);
  await expect(noPurchasedDataAlert).toBeVisible();

  await showStep(page, 'Step 11: Test Completed');
  logInfo('✅ Purchased Dataset flow validated successfully');
});