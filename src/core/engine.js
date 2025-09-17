const { chromium, firefox, webkit } = require('playwright');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class SmartQACore extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.browsers = new Map();
    this.testQueue = [];
    this.isRunning = false;
    this.results = [];
  }

  async initialize() {
    logger.info('🔧 Initializing SmartQA Core Engine...');
    
    // Initialize browsers based on configuration
    const browserTypes = this.config.browsers || ['chromium'];
    
    for (const browserType of browserTypes) {
      try {
        let browser;
        switch (browserType) {
          case 'chromium':
            browser = await chromium.launch({ headless: this.config.headless });
            break;
          case 'firefox':
            browser = await firefox.launch({ headless: this.config.headless });
            break;
          case 'webkit':
            browser = await webkit.launch({ headless: this.config.headless });
            break;
          default:
            throw new Error(`Unsupported browser: ${browserType}`);
        }
        
        this.browsers.set(browserType, browser);
        logger.info(`✅ ${browserType} browser initialized`);
      } catch (error) {
        logger.error(`❌ Failed to initialize ${browserType}:`, error.message);
      }
    }

    if (this.browsers.size === 0) {
      throw new Error('No browsers could be initialized');
    }
  }

  async runTests(tests) {
    if (!Array.isArray(tests)) {
      tests = [tests];
    }

    logger.info(`🧪 Running ${tests.length} tests...`);
    this.isRunning = true;
    this.results = [];

    const startTime = Date.now();

    try {
      // Run tests in parallel across browsers
      const promises = [];
      
      for (const [browserType, browser] of this.browsers) {
        for (const test of tests) {
          promises.push(this.executeTest(browser, browserType, test));
        }
      }

      const results = await Promise.allSettled(promises);
      
      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
        } else {
          this.results.push({
            status: 'failed',
            error: result.reason.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ Test execution completed in ${duration}ms`);
      
      this.emit('testsCompleted', {
        results: this.results,
        duration,
        summary: this.generateSummary()
      });

      return this.results;

    } catch (error) {
      logger.error('❌ Test execution failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async executeTest(browser, browserType, test) {
    const context = await browser.newContext({
      viewport: test.viewport || { width: 1920, height: 1080 },
      userAgent: test.userAgent,
      ...test.contextOptions
    });

    const page = await context.newPage();
    
    const testResult = {
      id: test.id || `test_${Date.now()}`,
      name: test.name,
      browser: browserType,
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      screenshots: [],
      errors: []
    };

    try {
      // Execute test steps
      for (const step of test.steps || []) {
        const stepResult = await this.executeStep(page, step);
        testResult.steps.push(stepResult);
        
        if (stepResult.status === 'failed' && !step.continueOnFailure) {
          throw new Error(`Step failed: ${stepResult.error}`);
        }
      }

      testResult.status = 'passed';
      testResult.endTime = new Date().toISOString();
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      testResult.endTime = new Date().toISOString();
      
      // Take screenshot on failure
      try {
        const screenshot = await page.screenshot({ fullPage: true });
        testResult.screenshots.push({
          type: 'failure',
          data: screenshot.toString('base64'),
          timestamp: new Date().toISOString()
        });
      } catch (screenshotError) {
        logger.warn('Failed to capture failure screenshot:', screenshotError.message);
      }
    } finally {
      await context.close();
    }

    this.emit('testCompleted', testResult);
    return testResult;
  }

  async executeStep(page, step) {
    const stepResult = {
      name: step.name,
      action: step.action,
      startTime: new Date().toISOString(),
      status: 'running'
    };

    try {
      switch (step.action) {
        case 'navigate':
          await page.goto(step.url, { waitUntil: step.waitUntil || 'networkidle' });
          break;

        case 'click':
          await page.click(step.selector, step.options);
          break;

        case 'fill':
          await page.fill(step.selector, step.value);
          break;

        case 'type':
          await page.type(step.selector, step.text, step.options);
          break;

        case 'wait':
          if (step.selector) {
            await page.waitForSelector(step.selector, step.options);
          } else if (step.timeout) {
            await page.waitForTimeout(step.timeout);
          }
          break;

        case 'screenshot':
          const screenshot = await page.screenshot(step.options || {});
          stepResult.screenshot = screenshot.toString('base64');
          break;

        case 'assert':
          await this.executeAssertion(page, step);
          break;

        case 'custom':
          if (typeof step.handler === 'function') {
            await step.handler(page, step.params);
          }
          break;

        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      stepResult.status = 'passed';
      stepResult.endTime = new Date().toISOString();

    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
      stepResult.endTime = new Date().toISOString();
    }

    return stepResult;
  }

  async executeAssertion(page, step) {
    switch (step.type) {
      case 'text':
        const text = await page.textContent(step.selector);
        if (step.expected !== text) {
          throw new Error(`Text assertion failed. Expected: "${step.expected}", Got: "${text}"`);
        }
        break;

      case 'visible':
        const isVisible = await page.isVisible(step.selector);
        if (step.expected !== isVisible) {
          throw new Error(`Visibility assertion failed. Expected: ${step.expected}, Got: ${isVisible}`);
        }
        break;

      case 'url':
        const url = page.url();
        if (step.expected !== url) {
          throw new Error(`URL assertion failed. Expected: "${step.expected}", Got: "${url}"`);
        }
        break;

      case 'count':
        const count = await page.locator(step.selector).count();
        if (step.expected !== count) {
          throw new Error(`Count assertion failed. Expected: ${step.expected}, Got: ${count}`);
        }
        break;

      default:
        throw new Error(`Unknown assertion type: ${step.type}`);
    }
  }

  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    return {
      total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? (passed / total * 100).toFixed(2) : 0
    };
  }

  async cleanup() {
    logger.info('🧹 Cleaning up SmartQA Core...');
    
    for (const [browserType, browser] of this.browsers) {
      try {
        await browser.close();
        logger.info(`✅ ${browserType} browser closed`);
      } catch (error) {
        logger.error(`❌ Error closing ${browserType}:`, error.message);
      }
    }
    
    this.browsers.clear();
  }
}

module.exports = { SmartQACore };