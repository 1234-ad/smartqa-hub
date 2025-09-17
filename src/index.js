#!/usr/bin/env node

const { SmartQACore } = require('./core/engine');
const { AITestGenerator } = require('./ai/generator');
const { VisualTester } = require('./visual/tester');
const { APITester } = require('./api/tester');
const { Dashboard } = require('./dashboard/server');
const logger = require('./utils/logger');
const config = require('../config/default.json');

class SmartQAHub {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.core = new SmartQACore(this.config);
    this.aiGenerator = new AITestGenerator(this.config.ai);
    this.visualTester = new VisualTester(this.config.visual);
    this.apiTester = new APITester(this.config.api);
    this.dashboard = new Dashboard(this.config.dashboard);
  }

  async initialize() {
    logger.info('🚀 Initializing SmartQA Hub...');
    
    try {
      await this.core.initialize();
      await this.dashboard.start();
      
      logger.info('✅ SmartQA Hub initialized successfully');
      logger.info(`📊 Dashboard available at: http://localhost:${this.config.dashboard.port}`);
      
      return this;
    } catch (error) {
      logger.error('❌ Failed to initialize SmartQA Hub:', error);
      throw error;
    }
  }

  async runTestSuite(suiteName, options = {}) {
    logger.info(`🧪 Running test suite: ${suiteName}`);
    
    const results = {
      suite: suiteName,
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };

    try {
      // Run different types of tests based on configuration
      if (options.includeVisual) {
        const visualResults = await this.visualTester.runTests();
        results.tests.push(...visualResults);
      }

      if (options.includeAPI) {
        const apiResults = await this.apiTester.runTests();
        results.tests.push(...apiResults);
      }

      if (options.generateAI) {
        const aiTests = await this.aiGenerator.generateTests(suiteName);
        const aiResults = await this.core.runTests(aiTests);
        results.tests.push(...aiResults);
      }

      // Calculate summary
      results.summary.total = results.tests.length;
      results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
      results.summary.failed = results.tests.filter(t => t.status === 'failed').length;
      results.summary.skipped = results.tests.filter(t => t.status === 'skipped').length;

      // Send results to dashboard
      this.dashboard.broadcastResults(results);

      logger.info(`✅ Test suite completed: ${results.summary.passed}/${results.summary.total} passed`);
      return results;

    } catch (error) {
      logger.error(`❌ Test suite failed: ${error.message}`);
      throw error;
    }
  }

  async generateAITests(description) {
    return await this.aiGenerator.generateFromDescription(description);
  }

  async shutdown() {
    logger.info('🛑 Shutting down SmartQA Hub...');
    await this.dashboard.stop();
    await this.core.cleanup();
    logger.info('✅ SmartQA Hub shutdown complete');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const hub = new SmartQAHub();

  async function main() {
    await hub.initialize();

    switch (command) {
      case 'test':
        const suiteName = args[1] || 'default';
        const options = {
          includeVisual: args.includes('--visual'),
          includeAPI: args.includes('--api'),
          generateAI: args.includes('--ai')
        };
        await hub.runTestSuite(suiteName, options);
        break;

      case 'dashboard':
        logger.info('📊 Dashboard running... Press Ctrl+C to stop');
        break;

      case 'generate':
        const description = args.slice(1).join(' ');
        const tests = await hub.generateAITests(description);
        console.log(JSON.stringify(tests, null, 2));
        break;

      default:
        console.log(`
🚀 SmartQA Hub - Innovative QA Testing Framework

Usage:
  node src/index.js test [suite-name] [--visual] [--api] [--ai]
  node src/index.js dashboard
  node src/index.js generate <test description>

Examples:
  node src/index.js test login --visual --api
  node src/index.js generate "test user registration flow"
        `);
    }
  }

  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    await hub.shutdown();
    process.exit(0);
  });
}

module.exports = { SmartQAHub };