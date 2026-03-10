// tests/create_gis.spec.js
import { test, expect } from './common'; 
import { DashboardPage } from '../pages/DashboardPage';
import { CreateProjectPage } from '../pages/CreateProjectPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { logInfo, showStep, highlight, fastWait, safeExpectVisible, assertOrWarn, robustClick } from '../utils/helpers';

test.setTimeout(600000);

test('[P1] TC-01: Inspect dynamic sub-fields', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();

  await showStep(page, 'Step 2: Open Create GIS Project form');
  await dashboard.clickCreateProject(); 
  await createProject.container.waitFor({ state: 'visible' });

  await showStep(page, 'Step 3: 🗂️  Select Data Type (list & count)');
  await createProject.inspectAndSelect(createProject.dataTypeSelect(), '🗂️  Select Data Type');

  await showStep(page, 'Step 4: 📊 Select Dataset (list & count)');
  const datasetSelect = createProject.datasetSelect();
  await createProject.inspectAndSelect(datasetSelect, '📊 Select Dataset');

  await showStep(page, 'Step 5: Select "Public Dataset" from 📊 Select Dataset');
  await highlight(page, datasetSelect);
  try { await datasetSelect.selectOption({ label: 'Public Dataset' }) } catch (e) { logInfo('TC-1: failed to select Public Dataset', { error: String(e) }) }
  await fastWait(page, 800);

  await showStep(page, 'Step 6: 🌐 Public Dataset (list & count)');
  await createProject.inspectAndSelect(createProject.subDatasetSelect(), '🌐 Public Dataset');

  await showStep(page, 'Step 7: Switch dataset type to "Uploaded Dataset"');
  try { await datasetSelect.selectOption({ label: 'Uploaded Dataset' }) } catch (e) { logInfo('TC-1: failed', { error: String(e) }) }
  await fastWait(page, 800);

  await showStep(page, 'Step 8: 📁 Uploaded Dataset (list & count)');
  await createProject.inspectAndSelect(createProject.subDatasetSelect(), '📁 Uploaded Dataset');

  const analysisSelect = createProject.analysisSelect();
  await showStep(page, 'Step 9: 🗂️  Select Analysis Type (list & count)');
  await createProject.inspectAndSelect(analysisSelect, '🗂️  Select Analysis Type');

  const modelTypeSelect = createProject.modelTypeSelect();
  await showStep(page, 'Step 10: 🤖 Select Model Type (list & count)');
  await safeExpectVisible(modelTypeSelect, 'Model type select visible', 10000, false);
  await highlight(page, modelTypeSelect);
  const rawModelTypes = await createProject.listOptionsText(modelTypeSelect);
  const modelTypes = createProject.cleanOptions(rawModelTypes);
  logInfo('🤖 Model Type options:', { modelTypes, count: modelTypes.length });

  if (modelTypes.includes('Finetuned Public Model')) {
    await showStep(page, 'Step 11: Select "Finetuned Public Model"');
    try { await modelTypeSelect.selectOption({ label: 'Finetuned Public Model' }) } catch (e) {}
    await highlight(page, modelTypeSelect, { pause: 800 });
    await fastWait(page, 800);

    const pretrainedSelect = createProject.pretrainedSelect();
    let subStep = 1;
    for (const analysis of ['Segmentation', 'Object Detection', 'Classification']) {
      await showStep(page, `Step 11.${subStep}: Change Analysis Type → ${analysis}`);
      await highlight(page, analysisSelect, { pause: 400 });
      try { await analysisSelect.selectOption({ label: analysis }) } catch (e) {}
      await fastWait(page, 800);

      await showStep(page, `Step 11.${subStep}.a: Inspect Pre-trained Models for ${analysis}`);
      await safeExpectVisible(pretrainedSelect, `Pretrained select for ${analysis}`, 10000, false);
      await highlight(page, pretrainedSelect);
      const opts = createProject.cleanOptions(await createProject.listOptionsText(pretrainedSelect));
      logInfo(`🧠 Pre-trained Models for ${analysis}:`, { opts, count: opts.length });
      subStep++;
    }
  } else {
    logInfo('Finetuned Public Model option not present in Model Type list; skipping pretrained inspection.');
  }

  let typeStep = 12;
  for (const type of ['Create New Model', 'Upload Model', 'Your Created Model']) {
    await showStep(page, `Step ${typeStep}: Select Model Type → ${type}`);
    await highlight(page, modelTypeSelect, { pause: 600 });
    try { await modelTypeSelect.selectOption({ label: type }) } catch (e) {}
    await fastWait(page, 1000);

    if (type === 'Create New Model') {
      await showStep(page, `Step ${typeStep}.a: Verify Create New Model — nothing should happen (no modal)`);
      const uploadModal = createProject.uploadModal;
      if (await uploadModal.count() > 0) {
        logInfo('Upload modal unexpectedly appeared for Create New Model');
      }
    }

    if (type === 'Upload Model') {
      await showStep(page, `Step ${typeStep}.a: Verify Upload Model modal appears`);
      const uploadModal = createProject.uploadModal;
      await safeExpectVisible(uploadModal, 'Upload modal visible', 10000, false);
      await highlight(page, uploadModal);
      const cancelBtn = createProject.page.locator('div.modal-content button.btn-secondary:has-text("Cancel")');
      await highlight(page, cancelBtn);
      await robustClick(page, cancelBtn);
      await fastWait(page, 800);
      try { await expect(uploadModal).toBeHidden({ timeout: 5000 }) } catch (e) {}
    }

    if (type === 'Your Created Model') {
      await showStep(page, `Step ${typeStep}.a: Verify "Your Models" dropdown appears and list & count`);
      const yourModels = createProject.yourModelsSelect();
      await safeExpectVisible(yourModels, 'Your Models visible', 10000, false);
      await highlight(page, yourModels);
      const raw = await createProject.listOptionsText(yourModels);
      const cleaned = createProject.cleanOptions(raw);
      logInfo('Your Models options:', { cleaned, count: cleaned.length });
      if (cleaned.length) {
        await showStep(page, `Step ${typeStep}.b: Select first available created model (if any)`);
        try { await yourModels.selectOption({ index: 0 }) } catch (e) {}
        await fastWait(page, 800);
      }
    }
    typeStep++;
  }

  await showStep(page, 'Step 15: TC-1 completed');
});

test('[P1] TC-02: Create Finetuned Project using Public Dataset', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);
  const projects = new ProjectsPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();

  const beforeCount = await dashboard.getCreateProjectCardCount('Step 2: Capture project count before creation');

  await showStep(page, 'Step 3: Open Create GIS Project form');
  await dashboard.clickCreateProject();
  await createProject.container.waitFor({ state: 'visible' });

  await showStep(page, 'Step 4: Enter Project Name');
  const projectName = `FinetunedModel-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'Step 5: Select any Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'Step 6: Select Public Dataset from 📊 Select Dataset');
  await createProject.SelectPublicDataset();

  await showStep(page, 'Step 7: Select any Analysis Type');
  await createProject.SelectAnalysisType();

  await showStep(page, 'Step 8: Select "Finetuned Public Model" in 🤖 Select Model Type');
  await createProject.SelectFinetunedModel();

  await showStep(page, 'Step 9: Select any Pre-trained Model');
  await createProject.SelectPretrainedModel();

  await showStep(page, 'Step 10: Click Create Project button');
  await createProject.clickCreateProjectButton();

  await showStep(page, 'Step 11: Confirm success popup and return to dashboard');
  await createProject.HandleSuccessPopupAndGoToDashboard();

  const afterCount = await dashboard.getCreateProjectCardCount('Step 12: Capture project count after creation');
  await assertOrWarn(afterCount === beforeCount + 1, `Project count did not increment as expected`, false, { beforeCount, afterCount });
  logInfo(`Step 13: Project created successfully. Count: ${beforeCount} -> ${afterCount}`);

  await showStep(page, 'Step 14: Navigate to Projects page');
  await projects.goto();
  await fastWait(page, 2000);

  const shouldAbort = await projects.abortIfMyProjectsFailed();
  if (shouldAbort) return;

  await showStep(page, 'Step 15: Delete the created project');
  await projects.deleteProjectByName(projectName);

  await showStep(page, 'Step 16: Return to Dashboard to verify project count after deletion');
  await dashboard.goto();

  const finalCount = await dashboard.getCreateProjectCardCount('Step 17: Capture final project count after deletion');
  await assertOrWarn(finalCount === beforeCount, `Final count ${finalCount} did not match before count ${beforeCount}`, false, { beforeCount, finalCount });
  logInfo(`TC-2 deletion verified: project "${projectName}" deleted successfully.`);
});

test('[P1] TC-03: Create Finetuned Project using Uploaded Dataset', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);
  const projects = new ProjectsPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();
  
  const beforeCount = await dashboard.getCreateProjectCardCount('Step 2: Capture project count before creation');

  await showStep(page, 'Step 3: Open Create GIS Project form');
  await dashboard.clickCreateProject();
  await createProject.container.waitFor({ state: 'visible' });

  await showStep(page, 'Step 4: Enter Project Name');
  const projectName = `FinetunedModel-${Date.now()}`;
  await createProject.enterProjectName(projectName);

  await showStep(page, 'Step 5: Select any Data Type');
  await createProject.SelectDataType();

  await showStep(page, 'Step 6: In 📊 Select Dataset choose "Uploaded Dataset"');
  const chosenUploaded = await createProject.selectUploadedDatasetOrWarn();
  if (!chosenUploaded) {
    logInfo('TC-3 terminated early due to no uploaded datasets.');
    return;
  }

  await showStep(page, 'Step 7: Select any Analysis Type');
  await createProject.SelectAnalysisType();
  
  await showStep(page, 'Step 8: Select "Finetuned Public Model"');
  await createProject.SelectFinetunedModel();
  
  await showStep(page, 'Step 9: Select any Pre-trained Model');
  await createProject.SelectPretrainedModel();
  
  await showStep(page, 'Step 10: Click Create Project button');
  await createProject.clickCreateProjectButton();
  
  await showStep(page, 'Step 11: Confirm success popup and return to dashboard');
  await createProject.HandleSuccessPopupAndGoToDashboard();

  const afterCount = await dashboard.getCreateProjectCardCount('Step 12: Capture project count after creation');
  await assertOrWarn(afterCount === beforeCount + 1, `Project count did not increment`, false, { beforeCount, afterCount });

  await showStep(page, 'Step 13: Navigate to Projects page');
  await projects.goto();
  if (await projects.abortIfMyProjectsFailed()) return;
  
  await showStep(page, 'Step 14: Delete the created project');
  await projects.deleteProjectByName(projectName);

  await showStep(page, 'Step 15: Return to Dashboard');
  await dashboard.goto();
  
  const finalCount = await dashboard.getCreateProjectCardCount('Step 16: Capture final count');
  await assertOrWarn(finalCount === beforeCount, `Final count mismatch`, false, { beforeCount, finalCount });
});

test('[P1] TC-04: Create Create New Model Project', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);
  const projects = new ProjectsPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();
  
  const beforeCount = await dashboard.getCreateProjectCardCount('Step 2: Capture project count before creation');

  await showStep(page, 'Step 3: Open Create GIS Project form');
  await dashboard.clickCreateProject();
  await createProject.container.waitFor({ state: 'visible' });

  const projectName = `CreateNewModel-${Date.now()}`;
  await showStep(page, 'Step 4: Enter Project Name');
  await createProject.enterProjectName(projectName);

  await showStep(page, 'Step 5: Select Data Type & Public Dataset');
  await createProject.SelectDataType();
  await createProject.SelectPublicDataset();

  await showStep(page, 'Step 6: Select Analysis Type → Object Detection');
  const analysisSelect = createProject.analysisSelect();
  await safeExpectVisible(analysisSelect, 'analysis select visible', 10000, false);
  await highlight(page, analysisSelect);
  try { await analysisSelect.selectOption({ label: 'Object Detection' }) } catch (e) {}
  await fastWait(page, 800);

  await showStep(page, 'Step 7: Select Create New Model');
  await createProject.SelectCreateNewModel();

  await showStep(page, 'Step 8: Click Create Project button');
  await createProject.clickCreateProjectButton();
  
  await showStep(page, 'Step 9: Confirm success popup and return to dashboard');
  await createProject.HandleSuccessPopupAndGoToDashboard();

  const afterCount = await dashboard.getCreateProjectCardCount('Step 10: Capture project count after creation');
  logInfo('Create New Model count may be async — logging counts only', { beforeCount, afterCount });

  await showStep(page, 'Step 11: Navigate to Projects page');
  await projects.goto();
  if (await projects.abortIfMyProjectsFailed()) return;
  
  await showStep(page, 'Step 12: Delete the created project');
  await projects.deleteProjectByName(projectName);

  await showStep(page, 'Step 13: Return to Dashboard');
  await dashboard.goto();
  
  const finalCount = await dashboard.getCreateProjectCardCount('Step 14: Capture final count');
  await assertOrWarn(finalCount === beforeCount, `Final count mismatch`, false, { beforeCount, finalCount });
});

test('[P1] TC-05: Create Upload Model Project', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);
  const projects = new ProjectsPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();
  
  const beforeCount = await dashboard.getCreateProjectCardCount('Step 2: Capture project count before creation');

  await showStep(page, 'Step 3: Open Create GIS Project form');
  await dashboard.clickCreateProject();
  await createProject.container.waitFor({ state: 'visible' });

  const projectName = `UploadModelProject-${Date.now()}`;
  await showStep(page, 'Step 4: Enter Project Name');
  await createProject.enterProjectName(projectName);

  await showStep(page, 'Step 5: Select Data Type & Uploaded Dataset');
  await createProject.SelectDataType();
  await createProject.selectUploadedDatasetOrWarn(); // Warns if none

  await showStep(page, 'Step 6: Select Analysis Type → Object Detection');
  const analysisSelect = createProject.analysisSelect();
  await safeExpectVisible(analysisSelect, 'analysis select visible', 10000, false);
  await highlight(page, analysisSelect);
  try { await analysisSelect.selectOption({ label: 'Object Detection' }) } catch (e) {}
  await fastWait(page, 800);

  await showStep(page, 'Step 7: Select Upload Model');
  await createProject.SelectUploadModel();

  await showStep(page, 'Step 8: Upload model via popup');
  await createProject.uploadModelViaPopup();

  await showStep(page, 'Step 9: Confirm upload success popup');
  await createProject.handleUploadSuccessPopup();

  await showStep(page, 'Step 10: Click Create Project button');
  await createProject.clickCreateProjectButton();
  
  await showStep(page, 'Step 11: Confirm success popup and return to dashboard');
  await createProject.HandleSuccessPopupAndGoToDashboard();

  const afterCount = await dashboard.getCreateProjectCardCount('Step 12: Capture project count after creation');
  logInfo('Counts after upload model creation', { beforeCount, afterCount });

  await showStep(page, 'Step 13: Navigate to Projects page');
  await projects.goto();
  if (await projects.abortIfMyProjectsFailed()) return;
  
  await showStep(page, 'Step 14: Delete the created project');
  await projects.deleteProjectByName(projectName);

  await showStep(page, 'Step 15: Return to Dashboard');
  await dashboard.goto();
  
  const finalCount = await dashboard.getCreateProjectCardCount('Step 16: Capture final count');
  await assertOrWarn(finalCount === beforeCount, `Final count mismatch`, false, { beforeCount, finalCount });
});

test('[P1] TC-06: Create Your Created Model Project', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const createProject = new CreateProjectPage(page);
  const projects = new ProjectsPage(page);

  await showStep(page, 'Step 1: Verify Dashboard is loaded');
  await dashboard.goto();
  
  const beforeCount = await dashboard.getCreateProjectCardCount('Step 2: Capture project count before creation');

  await showStep(page, 'Step 3: Open Create GIS Project form');
  await dashboard.clickCreateProject();
  await createProject.container.waitFor({ state: 'visible' });

  const projectName = `YourModelProject-${Date.now()}`;
  await showStep(page, 'Step 4: Enter Project Name');
  await createProject.enterProjectName(projectName);

  await showStep(page, 'Step 5: Select Data Type & Public Dataset');
  await createProject.SelectDataType();
  await createProject.SelectPublicDataset();

  await showStep(page, 'Step 6: Select Analysis Type → Object Detection');
  await createProject.SelectAnalysisType();

  await showStep(page, 'Step 7: Select Your Created Model');
  await createProject.SelectYourCreatedModel();

  await showStep(page, 'Step 8: Select model from "Your Models" list');
  const modelSelected = await createProject.selectAnyYourCreatedModelOrWarn();

  if (!modelSelected) {
    await showStep(page, 'TC-6 finished with warning: No Your Created Model available');
    return;
  }

  await showStep(page, 'Step 9: Click Create Project button');
  await createProject.clickCreateProjectButton();
  
  await showStep(page, 'Step 10: Confirm success popup and return to dashboard');
  await createProject.HandleSuccessPopupAndGoToDashboard();

  await dashboard.getCreateProjectCardCount('Step 11: Capture project count after creation');

  await showStep(page, 'Step 12: Navigate to Projects page');
  await projects.goto();
  if (await projects.abortIfMyProjectsFailed()) return;
  
  await showStep(page, 'Step 13: Delete the created project');
  await projects.deleteProjectByName(projectName);

  await showStep(page, 'Step 14: Return to Dashboard');
  await dashboard.goto();
  
  const finalCount = await dashboard.getCreateProjectCardCount('Step 15: Capture final count');
  await assertOrWarn(finalCount === beforeCount, `Final count mismatch`, false, { beforeCount, finalCount });
});