const sharp = require('sharp');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class VisualTester {
  constructor(config = {}) {
    this.config = {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.1,
      diffColor: [255, 0, 255],
      baselineDir: './tests/visual/baselines',
      outputDir: './tests/visual/output',
      diffDir: './tests/visual/diffs',
      ...config
    };
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [this.config.baselineDir, this.config.outputDir, this.config.diffDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.warn(`Failed to create directory ${dir}:`, error.message);
      }
    }
  }

  async runTests(testSuite = []) {
    logger.info('👁️ Running visual regression tests...');
    
    const results = [];
    
    for (const test of testSuite) {
      try {
        const result = await this.runVisualTest(test);
        results.push(result);
      } catch (error) {
        results.push({
          id: test.id,
          name: test.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info(`✅ Visual tests completed: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
    return results;
  }

  async runVisualTest(test) {
    const testResult = {
      id: test.id,
      name: test.name,
      type: 'visual',
      status: 'running',
      startTime: new Date().toISOString(),
      screenshots: [],
      comparisons: []
    };

    try {
      // Take current screenshot
      const currentScreenshot = await this.takeScreenshot(test);
      const currentPath = path.join(this.config.outputDir, `${test.id}_current.png`);
      await fs.writeFile(currentPath, currentScreenshot);
      
      testResult.screenshots.push({
        type: 'current',
        path: currentPath,
        timestamp: new Date().toISOString()
      });

      // Check if baseline exists
      const baselinePath = path.join(this.config.baselineDir, `${test.id}_baseline.png`);
      const baselineExists = await this.fileExists(baselinePath);

      if (!baselineExists) {
        // Create baseline
        await fs.copyFile(currentPath, baselinePath);
        testResult.status = 'baseline_created';
        testResult.message = 'Baseline image created';
      } else {
        // Compare with baseline
        const comparison = await this.compareImages(baselinePath, currentPath, test.id);
        testResult.comparisons.push(comparison);
        
        if (comparison.pixelDifference <= this.config.threshold) {
          testResult.status = 'passed';
        } else {
          testResult.status = 'failed';
          testResult.message = `Visual difference detected: ${comparison.pixelDifference.toFixed(2)}% pixels differ`;
        }
      }

      testResult.endTime = new Date().toISOString();
      return testResult;

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      testResult.endTime = new Date().toISOString();
      return testResult;
    }
  }

  async takeScreenshot(test) {
    // This would integrate with the browser from the core engine
    // For now, we'll simulate screenshot taking
    logger.info(`📸 Taking screenshot for test: ${test.name}`);
    
    // In a real implementation, this would use Playwright to take screenshots
    // return await page.screenshot({ fullPage: true });
    
    // Placeholder: create a simple test image
    const width = test.viewport?.width || 1920;
    const height = test.viewport?.height || 1080;
    
    return await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toBuffer();
  }

  async compareImages(baselinePath, currentPath, testId) {
    logger.info(`🔍 Comparing images for test: ${testId}`);
    
    try {
      const baseline = PNG.sync.read(await fs.readFile(baselinePath));
      const current = PNG.sync.read(await fs.readFile(currentPath));
      
      const { width, height } = baseline;
      const diff = new PNG({ width, height });
      
      const pixelDiff = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        width,
        height,
        {
          threshold: this.config.threshold,
          includeAA: this.config.includeAA,
          alpha: this.config.alpha,
          diffColor: this.config.diffColor
        }
      );

      const totalPixels = width * height;
      const pixelDifference = (pixelDiff / totalPixels) * 100;

      // Save diff image if there are differences
      if (pixelDiff > 0) {
        const diffPath = path.join(this.config.diffDir, `${testId}_diff.png`);
        await fs.writeFile(diffPath, PNG.sync.write(diff));
        
        return {
          pixelDiff,
          pixelDifference,
          totalPixels,
          diffImagePath: diffPath,
          baselinePath,
          currentPath,
          passed: pixelDifference <= this.config.threshold
        };
      }

      return {
        pixelDiff: 0,
        pixelDifference: 0,
        totalPixels,
        passed: true,
        message: 'Images are identical'
      };

    } catch (error) {
      throw new Error(`Image comparison failed: ${error.message}`);
    }
  }

  async createBaseline(testId, screenshotBuffer) {
    const baselinePath = path.join(this.config.baselineDir, `${testId}_baseline.png`);
    await fs.writeFile(baselinePath, screenshotBuffer);
    logger.info(`📝 Created baseline for test: ${testId}`);
    return baselinePath;
  }

  async updateBaseline(testId) {
    const currentPath = path.join(this.config.outputDir, `${testId}_current.png`);
    const baselinePath = path.join(this.config.baselineDir, `${testId}_baseline.png`);
    
    if (await this.fileExists(currentPath)) {
      await fs.copyFile(currentPath, baselinePath);
      logger.info(`🔄 Updated baseline for test: ${testId}`);
      return true;
    }
    
    return false;
  }

  async generateVisualReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        baselineCreated: results.filter(r => r.status === 'baseline_created').length
      },
      tests: results.map(result => ({
        id: result.id,
        name: result.name,
        status: result.status,
        message: result.message,
        screenshots: result.screenshots,
        comparisons: result.comparisons
      }))
    };

    const reportPath = path.join(this.config.outputDir, 'visual-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info(`📊 Visual test report saved to: ${reportPath}`);
    return report;
  }

  async cleanupOldResults(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const dirs = [this.config.outputDir, this.config.diffDir];
    
    for (const dir of dirs) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`🗑️ Cleaned up old file: ${file}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to cleanup directory ${dir}:`, error.message);
      }
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Advanced visual testing features
  async detectLayoutShifts(beforeScreenshot, afterScreenshot) {
    // Implement layout shift detection algorithm
    logger.info('🔄 Detecting layout shifts...');
    
    // This would analyze the two screenshots to detect unexpected layout changes
    // Implementation would involve image segmentation and element position tracking
    
    return {
      shiftsDetected: false,
      shifts: [],
      cumulativeLayoutShift: 0
    };
  }

  async analyzeColorContrast(screenshot) {
    // Implement color contrast analysis for accessibility
    logger.info('🎨 Analyzing color contrast...');
    
    return {
      contrastRatio: 4.5,
      wcagCompliant: true,
      issues: []
    };
  }

  async detectResponsiveBreakpoints(testConfig) {
    // Test multiple viewport sizes to detect responsive issues
    const viewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];

    const results = [];
    
    for (const viewport of viewports) {
      const test = { ...testConfig, viewport };
      const result = await this.runVisualTest(test);
      results.push({ ...result, viewport: viewport.name });
    }

    return results;
  }
}

module.exports = { VisualTester };