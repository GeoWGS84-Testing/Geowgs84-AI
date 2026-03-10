// pages/BasePage.js
import { 
  showStep, highlight, assertVisible, openAndCloseNewPageFromClick, 
  tryClickAndMaybeNavigate, robustClick, waitAndFill, setContext, clearContext, logInfo, waitForVisible, fastWait, addWarning 
} from '../utils/helpers';

export class BasePage {
  constructor(page) {
    this.page = page;
  }

  async highlightElement(locator) {
    await highlight(this.page, locator);
  }

  async showStep(text) {
    await showStep(this.page, text);
  }

  async robustClick(locator, opts = {}) {
    await robustClick(this.page, locator, opts);
  }

  async assertVisible(locator, label) {
    return await assertVisible(locator, label);
  }

  async waitForVisible(locator, timeout) {
    return await waitForVisible(locator, timeout);
  }

  async fastWait(ms) {
    await fastWait(this.page, ms);
  }

  // Helper for opening new tabs
  async openAndCloseNewPageFromClick(action, label = 'External Link') {
    await this.showStep(`Clicking ${label} (Opens new window)`);
    
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      action()
    ]);
    
    await newPage.waitForLoadState('domcontentloaded');
    const url = newPage.url();
    await this.showStep(`New window opened: ${url.substring(0, 60)}...`);
    logInfo(`New page opened: ${url}`);
    
    await newPage.close();
    await this.showStep('New window closed');
    return true;
  }

  // Helper for navigation
  async tryClickAndMaybeNavigate(locator, expectedUrlPart) {
    await locator.click();
    try {
      await this.page.waitForURL(`**/${expectedUrlPart}**`, { timeout: 5000 });
    } catch (e) {
      // Ignore
    }
  }
  
  // Flow helpers that preserve Testcase
  setFlow(flowName) {
    setContext({ flow: flowName });
  }

  clearFlow() {
    setContext({ flow: '' }); // Clears flow, keeps testcase
  }

  async fill(locator, value, opts = {}) {
    return waitAndFill(this.page, locator, value, opts);
  }

  // Specific helper from original code
  async clearAndType(input, value) {
    await input.click();
    try { await input.click({ clickCount: 3 }) } catch {}
    try {
      await input.press('Backspace');
      await input.press('Control+A');
      await input.press('Backspace');
    } catch {}
    try {
      await input.fill(value);
    } catch {
      await input.type(value);
    }
  }
}