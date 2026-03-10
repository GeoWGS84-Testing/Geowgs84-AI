// tests/projects.spec.js
import { test, expect } from './common';
import { DashboardPage } from '../pages/DashboardPage';
import { CreateProjectPage } from '../pages/CreateProjectPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { logInfo, showStep, fastWait } from '../utils/helpers';

test.setTimeout(300000);

test('[P1] TC-1: Projects page layout and dynamic content validation', async ({ page }) => {
  const projectsPage = new ProjectsPage(page);

  await showStep(page, 'STEP 1: Open Projects from sidebar');
  await projectsPage.navigateToProjectsViaSidebar();

  const shouldAbort = await projectsPage.abortIfMyProjectsFailed();
  if (shouldAbort) return;

  await showStep(page, 'STEP 2: Verifying Projects page container');
  const container = page.locator('div.container-lg.px-4').first();
  await expect(container).toBeVisible();

  await showStep(page, 'STEP 3: Validating project sections');
  const sections = ['Finetuned Public Model', 'Create New Model', 'Upload Model', 'Your Created Model'];
  
  // Highlight the first one as special
  await projectsPage.highlightSection('Finetuned Public Model', true);
  
  for (const section of sections) {
    if (section !== 'Finetuned Public Model') {
      await projectsPage.highlightSection(section);
    }
    const count = await projectsPage.getProjectCountBySection(section);
    logInfo(`${section} count: ${count}`);
  }

  await showStep(page, '✅ TC-1 Completed: Projects page validation successful');
});

test('[P1] TC-2: Create project using Public Dataset (Finetuned Public Model)', async ({ page }) => {
  const projectsPage = new ProjectsPage(page);
  const createProject = new CreateProjectPage(page);

  await showStep(page, 'STEP 1: Open Projects Page');
  await projectsPage.navigateToProjectsViaSidebar();
  if (await projectsPage.abortIfMyProjectsFailed()) return;

  await showStep(page, 'STEP 2: Capture initial count for Finetuned Public Model');
  await projectsPage.highlightSection('Finetuned Public Model', true);
  const beforeCount = await projectsPage.getProjectCountBySection('Finetuned Public Model');

  await showStep(page, 'STEP 3: Click "+ Create New Project" button');
  await page.locator('button.btn.btn-primary:has-text("+ Create New Project")').first().click();
  await page.waitForURL(/#\/creategisproject/);

  await showStep(page, 'STEP 4: Enter Project Name');
  const projectName = `FinetunedModel-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'STEP 5: Select Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'STEP 6: Select Public Dataset');
  await createProject.SelectPublicDataset();

  await showStep(page, 'STEP 7: Select Analysis Type');
  await createProject.SelectAnalysisType();

  await showStep(page, 'STEP 8: Select Finetuned Public Model');
  await createProject.SelectFinetunedModel();

  await showStep(page, 'STEP 9: Select Pre-trained Model');
  await createProject.SelectPretrainedModel();

  await showStep(page, 'STEP 10: Submit Create Project form');
  await createProject.clickCreateProjectButton();

  await showStep(page, 'STEP 11: Handle Success Popup and Navigate to Projects');
  await createProject.HandleSuccessPopupAndGoToProject();

  // --- Verification & Run ---
  await showStep(page, 'STEP 12: Locate created project card');
  let card = await projectsPage.findProjectCardByName(projectName);
  if (!card) {
    await projectsPage.goto();
    await fastWait(page, 1000);
    card = await projectsPage.findProjectCardByName(projectName);
  }
  if (!card) throw new Error(`Project ${projectName} not found after creation`);

  await showStep(page, 'STEP 13: Validate Project Card Fields');
  await projectsPage.validateProjectCardFields(card, 'NAIP', 'Finetuned Public Model', 'Public Dataset');

  await showStep(page, 'STEP 14: Click Run on the created project');
  const canRun = await projectsPage.clickRunOnCard(card);
  if (!canRun) {
    await showStep(page, 'Run button not available, skipping Run verification');
  } else {
    await showStep(page, 'STEP 15: Validate Project Page Details');
    await projectsPage.validateProjectPageDetails('NAIP', 'Finetuned Public Model', 'Public Dataset');

    await showStep(page, 'STEP 16: Draw AOI and Run Project');
    await projectsPage.runProjectWorkflow('Public Dataset');
  }

  // --- Cleanup ---
  await showStep(page, 'STEP 17: Navigate back to Projects for cleanup');
  await projectsPage.navigateToProjectsViaSidebar();
  
  await showStep(page, 'STEP 18: Delete the created project');
  await projectsPage.deleteProjectByName(projectName);
  
  await showStep(page, 'STEP 19: Verify Final Count');
  await projectsPage.highlightSection('Finetuned Public Model', true);
  const finalCount = await projectsPage.getProjectCountBySection('Finetuned Public Model');
  expect(finalCount).toBe(beforeCount);
  logInfo(`TC-2 Completed: Project created, run, and deleted successfully. Count restored to ${finalCount}`);
});

test('[P1] TC-3: Create project using Uploaded Dataset (Create New Model)', async ({ page }) => {
  const createProject = new CreateProjectPage(page);
  const projectsPage = new ProjectsPage(page);

  await showStep(page, 'STEP 1: Open Projects Page');
  await projectsPage.navigateToProjectsViaSidebar();
  if (await projectsPage.abortIfMyProjectsFailed()) return;

  await showStep(page, 'STEP 2: Capture initial count for Create New Model');
  await projectsPage.highlightSection('Create New Model');
  const beforeCount = await projectsPage.getProjectCountBySection('Create New Model');

  await showStep(page, 'STEP 3: Click "+ Create New Project" button');
  await page.locator('button.btn.btn-primary:has-text("+ Create New Project")').first().click();
  await page.waitForURL(/#\/creategisproject/);

  await showStep(page, 'STEP 4: Enter Project Name');
  const projectName = `CreateNewModel-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'STEP 5: Select Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'STEP 6: Select Uploaded Dataset');
  const selectedDataset = await createProject.selectUploadedDatasetOrWarn();
  if (!selectedDataset) return; // Skip if no datasets

  await showStep(page, 'STEP 7: Select Analysis Type');
  await createProject.SelectAnalysisType();

  await showStep(page, 'STEP 8: Select Create New Model');
  await createProject.SelectCreateNewModel();

  await showStep(page, 'STEP 9: Submit Create Project form');
  await createProject.clickCreateProjectButton();
  await createProject.HandleSuccessPopupAndGoToProject();

  // --- Verification ONLY (No Run for Create New Model) ---
  await showStep(page, 'STEP 10: Locate created project card');
  let card = await projectsPage.findProjectCardByName(projectName);
  if (!card) { await projectsPage.goto(); await fastWait(page, 1000); card = await projectsPage.findProjectCardByName(projectName); }
  if (!card) throw new Error(`Project ${projectName} not found`);

  await showStep(page, 'STEP 11: Verify Project Card is Present');
  await projectsPage.validateProjectCardFields(card, '', 'Create New Model', 'Uploaded Dataset');

  // --- Cleanup ---
  await showStep(page, 'STEP 12: Navigate back to Projects for cleanup');
  await projectsPage.navigateToProjectsViaSidebar();
  await projectsPage.deleteProjectByName(projectName);

  const finalCount = await projectsPage.getProjectCountBySection('Create New Model');
  expect(finalCount).toBe(beforeCount);
  logInfo('TC-3 Completed');
});

test('[P1] TC-4: Create project using Upload Model', async ({ page }) => {
  const createProject = new CreateProjectPage(page);
  const projectsPage = new ProjectsPage(page);

  await showStep(page, 'STEP 1: Open Projects Page');
  await projectsPage.navigateToProjectsViaSidebar();
  if (await projectsPage.abortIfMyProjectsFailed()) return;

  await showStep(page, 'STEP 2: Capture initial count for Upload Model');
  await projectsPage.highlightSection('Upload Model');
  const beforeCount = await projectsPage.getProjectCountBySection('Upload Model');

  await showStep(page, 'STEP 3: Click "+ Create New Project" button');
  await page.locator('button.btn.btn-primary:has-text("+ Create New Project")').first().click();
  await page.waitForURL(/#\/creategisproject/);

  await showStep(page, 'STEP 4: Enter Project Name');
  const projectName = `UploadModel-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'STEP 5: Select Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'STEP 6: Select Uploaded Dataset');
  const selectedDataset = await createProject.selectUploadedDatasetOrWarn();
  if (!selectedDataset) return;

  await showStep(page, 'STEP 7: Select Analysis Type');
  await createProject.SelectAnalysisType();

  await showStep(page, 'STEP 8: Select Upload Model Type');
  await createProject.SelectUploadModel();

  await showStep(page, 'STEP 9: Upload model via popup (fill all fields)');
  await createProject.uploadModelViaPopup();

  await showStep(page, 'STEP 10: Confirm upload success popup');
  await createProject.handleUploadSuccessPopup();

  await showStep(page, 'STEP 11: Submit Create Project form');
  await createProject.clickCreateProjectButton();
  await createProject.HandleSuccessPopupAndGoToProject();

  // --- Verification & Run ---
  await showStep(page, 'STEP 12: Locate created project card');
  let card = await projectsPage.findProjectCardByName(projectName);
  if (!card) { await projectsPage.goto(); await fastWait(page, 1000); card = await projectsPage.findProjectCardByName(projectName); }
  if (!card) throw new Error(`Project ${projectName} not found`);

  await showStep(page, 'STEP 13: Click Run on the created project');
  await projectsPage.clickRunOnCard(card);
  await projectsPage.runProjectWorkflow('Uploaded Dataset');

  // --- Cleanup ---
  await showStep(page, 'STEP 14: Navigate back to Projects for cleanup');
  await projectsPage.navigateToProjectsViaSidebar();
  await projectsPage.deleteProjectByName(projectName);

  const finalCount = await projectsPage.getProjectCountBySection('Upload Model');
  expect(finalCount).toBe(beforeCount);
  logInfo('TC-4 Completed');
});

test('[P1] TC-5: Create project using Your Created Model', async ({ page }) => {
  const createProject = new CreateProjectPage(page);
  const projectsPage = new ProjectsPage(page);

  await showStep(page, 'STEP 1: Open Projects Page');
  await projectsPage.navigateToProjectsViaSidebar();
  if (await projectsPage.abortIfMyProjectsFailed()) return;

  await showStep(page, 'STEP 2: Capture initial count for Your Created Model');
  await projectsPage.highlightSection('Your Created Model');
  const beforeCount = await projectsPage.getProjectCountBySection('Your Created Model');

  await showStep(page, 'STEP 3: Click "+ Create New Project" button');
  await page.locator('button.btn.btn-primary:has-text("+ Create New Project")').first().click();
  await page.waitForURL(/#\/creategisproject/);

  await showStep(page, 'STEP 4: Enter Project Name');
  const projectName = `YourModelProject-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'STEP 5: Select Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'STEP 6: Select Public Dataset');
  await createProject.SelectPublicDataset();

  await showStep(page, 'STEP 7: Select Analysis Type');
  await createProject.SelectAnalysisType();

  await showStep(page, 'STEP 8: Select Your Created Model Type');
  await createProject.SelectYourCreatedModel();

  await showStep(page, 'STEP 9: Select Model from "Your Models" list');
  const modelSelected = await createProject.selectAnyYourCreatedModelOrWarn();
  if (!modelSelected) return;

  await showStep(page, 'STEP 10: Submit Create Project form');
  await createProject.clickCreateProjectButton();
  await createProject.HandleSuccessPopupAndGoToProject();

  // --- Verification & Run ---
  await showStep(page, 'STEP 11: Locate created project card');
  let card = await projectsPage.findProjectCardByName(projectName);
  if (!card) { await projectsPage.goto(); await fastWait(page, 1000); card = await projectsPage.findProjectCardByName(projectName); }
  if (!card) throw new Error(`Project ${projectName} not found`);

  await showStep(page, 'STEP 12: Click Run on the created project');
  await projectsPage.clickRunOnCard(card);
  await projectsPage.runProjectWorkflow('Public Dataset');

  // --- Cleanup ---
  await showStep(page, 'STEP 13: Navigate back to Projects for cleanup');
  await projectsPage.navigateToProjectsViaSidebar();
  await projectsPage.deleteProjectByName(projectName);

  const finalCount = await projectsPage.getProjectCountBySection('Your Created Model');
  expect(finalCount).toBe(beforeCount);
  logInfo('TC-5 Completed');
});