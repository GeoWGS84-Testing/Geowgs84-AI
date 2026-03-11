// tests/upload_gis.spec.js
import { test, expect } from './common'; 
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';
import { logInfo, showStep } from '../utils/helpers';
import path from 'path';

// Helper for file paths
const dataPath = (filename) => path.join(process.cwd(), 'utils', 'testdata', filename);

test.setTimeout(600000);

test('[P0] TC-1: invalid file upload does NOT add dataset', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto(); 

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Initial count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload invalid file (.png)');
  await uploadPage.uploadSingleFile(dataPath('T1.png'));

  await uploadPage.showStep('Step 5: Verify error popup and close');
  await uploadPage.verifyAndCloseErrorPopup('Invalid file type');

  await uploadPage.showStep('Step 6: Return to dashboard');
  await dashboard.goto();

  await dashboard.verifyCountUnchanged(beforeCount, 'Invalid File upload');
  logInfo(`TEST PASSED: Count remained ${beforeCount}`);
});

test('[P0] TC-2 - invalid folder upload does NOT add dataset', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Initial count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload invalid folder');
  await uploadPage.uploadFolder(dataPath('T1'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Return to dashboard');
  await dashboard.goto();

  await dashboard.verifyCountUnchanged(beforeCount, 'Invalid Folder upload');
  logInfo(`TEST PASSED: Count remained ${beforeCount}`);
});

test('[P0] TC-3 - invalid ZIP upload does NOT add dataset', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Initial count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload invalid ZIP');
  await uploadPage.uploadZip(dataPath('T1.zip'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Return to dashboard');
  await dashboard.goto();

  await dashboard.verifyCountUnchanged(beforeCount, 'Invalid ZIP upload');
  logInfo(`TEST PASSED: Count remained ${beforeCount}`);
});

test('[P0] TC-4 - valid GIS .sid file upload', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Capture initial card count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload valid GIS file (.sid)');
  await uploadPage.uploadSingleFile(dataPath('T2.sid'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Verify dataset in table');
  const firstRow = await uploadPage.verifyDatasetInTable(datasetName);

  await uploadPage.showStep('Step 9: Handle Publish/Viewer, WMS, WCS flow');
  await uploadPage.handlePublishAndViewerFlow(firstRow);

  await uploadPage.showStep('Step 10: Return to dashboard');
  await dashboard.goto();

  await uploadPage.showStep('Step 11: Verify count increased');
  await dashboard.verifyCountIncreased(beforeCount);

  await uploadPage.showStep('Step 12: Navigate back to Upload GIS Data page for deletion');
  await uploadPage.goto();

  await uploadPage.showStep('Step 13: Delete uploaded dataset');
  await uploadPage.findAndDeleteDataset(datasetName);

  await uploadPage.showStep('Step 14: Return to dashboard after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getAndHighlightUploadCount('Step 15: Capture final card count');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TEST PASSED: Count restored to ${beforeCount} after deletion`);
});

test('[P0] TC-5 - valid GIS .tif file upload', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Capture initial card count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload valid GIS file (.sid)');
  await uploadPage.uploadSingleFile(dataPath('T3.tif'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Verify dataset in table');
  const firstRow = await uploadPage.verifyDatasetInTable(datasetName);

  await uploadPage.showStep('Step 9: Handle Publish/Viewer, WMS, WCS flow');
  await uploadPage.handlePublishAndViewerFlow(firstRow);

  await uploadPage.showStep('Step 10: Return to dashboard');
  await dashboard.goto();

  await uploadPage.showStep('Step 11: Verify count increased');
  await dashboard.verifyCountIncreased(beforeCount);

  await uploadPage.showStep('Step 12: Navigate back to Upload GIS Data page for deletion');
  await uploadPage.goto();

  await uploadPage.showStep('Step 13: Delete uploaded dataset');
  await uploadPage.findAndDeleteDataset(datasetName);

  await uploadPage.showStep('Step 14: Return to dashboard after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getAndHighlightUploadCount('Step 15: Capture final card count');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TEST PASSED: Count restored to ${beforeCount} after deletion`);
});

test('[P0] TC-6 - valid GIS .jp2 file upload', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Capture initial card count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload valid GIS file (.sid)');
  await uploadPage.uploadSingleFile(dataPath('T3.jp2'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Verify dataset in table');
  const firstRow = await uploadPage.verifyDatasetInTable(datasetName);

  await uploadPage.showStep('Step 9: Handle Publish/Viewer, WMS, WCS flow');
  await uploadPage.handlePublishAndViewerFlow(firstRow);

  await uploadPage.showStep('Step 10: Return to dashboard');
  await dashboard.goto();

  await uploadPage.showStep('Step 11: Verify count increased');
  await dashboard.verifyCountIncreased(beforeCount);

  await uploadPage.showStep('Step 12: Navigate back to Upload GIS Data page for deletion');
  await uploadPage.goto();

  await uploadPage.showStep('Step 13: Delete uploaded dataset');
  await uploadPage.findAndDeleteDataset(datasetName);

  await uploadPage.showStep('Step 14: Return to dashboard after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getAndHighlightUploadCount('Step 15: Capture final card count');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TEST PASSED: Count restored to ${beforeCount} after deletion`);
});

test('[P0] TC-7 - valid GIS folder upload', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Capture initial card count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload valid GIS folder');
  await uploadPage.uploadFolder(dataPath('T2'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Verify dataset in table');
  const firstRow = await uploadPage.verifyDatasetInTable(datasetName);

  await uploadPage.showStep('Step 9: Handle Publish/Viewer, WMS, WCS flow');
  await uploadPage.handlePublishAndViewerFlow(firstRow);

  await uploadPage.showStep('Step 10: Return to dashboard');
  await dashboard.goto();

  await uploadPage.showStep('Step 11: Verify count increased');
  await dashboard.verifyCountIncreased(beforeCount);

  await uploadPage.showStep('Step 12: Navigate back to Upload GIS Data page for deletion');
  await uploadPage.goto();

  await uploadPage.showStep('Step 13: Delete uploaded dataset');
  await uploadPage.findAndDeleteDataset(datasetName);

  await uploadPage.showStep('Step 14: Return to dashboard after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getAndHighlightUploadCount('Step 15: Capture final card count');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TEST PASSED: Count restored to ${beforeCount} after deletion`);
});

test('[P0] TC-8 - valid GIS ZIP upload', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const uploadPage = new UploadPage(page);

  await dashboard.showStep('Step 1: Starting Test');
  await dashboard.goto();

  const beforeCount = await dashboard.getAndHighlightUploadCount('Step 2: Capture initial card count');

  await dashboard.showStep('Step 3: Open Upload GIS Data page');
  await dashboard.robustClick(dashboard.uploadCard);
  await page.waitForURL('**/#/uploadgisdata');

  await uploadPage.showStep('Step 4: Upload valid GIS ZIP');
  await uploadPage.uploadZip(dataPath('T2.zip'));

  const datasetName = `UploadGISData${Date.now()}`;
  await uploadPage.showStep('Step 5: Enter unique dataset name');
  await uploadPage.enterDatasetName(datasetName);

  await uploadPage.showStep('Step 6: Submit upload');
  await uploadPage.submitUpload();

  await uploadPage.showStep('Step 7: Handle Upload Summary modal');
  await uploadPage.handleUploadSummaryModal();

  await uploadPage.showStep('Step 8: Verify dataset in table');
  const firstRow = await uploadPage.verifyDatasetInTable(datasetName);

  await uploadPage.showStep('Step 9: Handle Publish/Viewer, WMS, WCS flow');
  await uploadPage.handlePublishAndViewerFlow(firstRow);

  await uploadPage.showStep('Step 10: Return to dashboard');
  await dashboard.goto();

  await uploadPage.showStep('Step 11: Verify count increased');
  await dashboard.verifyCountIncreased(beforeCount);

  await uploadPage.showStep('Step 12: Navigate back to Upload GIS Data page for deletion');
  await uploadPage.goto();

  await uploadPage.showStep('Step 13: Delete uploaded dataset');
  await uploadPage.findAndDeleteDataset(datasetName);

  await uploadPage.showStep('Step 14: Return to dashboard after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getAndHighlightUploadCount('Step 15: Capture final card count');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TEST PASSED: Count restored to ${beforeCount} after deletion`);
});
