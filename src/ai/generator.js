const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const logger = require('../utils/logger');

class AITestGenerator {
  constructor(config = {}) {
    this.config = config;
    this.model = null;
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.patterns = this.loadTestPatterns();
  }

  loadTestPatterns() {
    return {
      login: {
        keywords: ['login', 'signin', 'authenticate', 'credentials'],
        steps: [
          { action: 'navigate', url: '/login' },
          { action: 'fill', selector: '[data-testid="username"]', value: '{{username}}' },
          { action: 'fill', selector: '[data-testid="password"]', value: '{{password}}' },
          { action: 'click', selector: '[data-testid="login-button"]' },
          { action: 'assert', type: 'url', expected: '/dashboard' }
        ]
      },
      registration: {
        keywords: ['register', 'signup', 'create account', 'join'],
        steps: [
          { action: 'navigate', url: '/register' },
          { action: 'fill', selector: '[name="email"]', value: '{{email}}' },
          { action: 'fill', selector: '[name="password"]', value: '{{password}}' },
          { action: 'fill', selector: '[name="confirmPassword"]', value: '{{password}}' },
          { action: 'click', selector: '[type="submit"]' },
          { action: 'assert', type: 'text', selector: '.success-message', expected: 'Account created successfully' }
        ]
      },
      search: {
        keywords: ['search', 'find', 'query', 'lookup'],
        steps: [
          { action: 'navigate', url: '/' },
          { action: 'fill', selector: '[data-testid="search-input"]', value: '{{searchTerm}}' },
          { action: 'click', selector: '[data-testid="search-button"]' },
          { action: 'wait', selector: '.search-results' },
          { action: 'assert', type: 'visible', selector: '.search-results', expected: true }
        ]
      },
      form: {
        keywords: ['form', 'submit', 'input', 'validation'],
        steps: [
          { action: 'navigate', url: '{{formUrl}}' },
          { action: 'fill', selector: '[name="{{fieldName}}"]', value: '{{fieldValue}}' },
          { action: 'click', selector: '[type="submit"]' },
          { action: 'assert', type: 'visible', selector: '.form-success', expected: true }
        ]
      },
      navigation: {
        keywords: ['navigate', 'menu', 'link', 'page'],
        steps: [
          { action: 'navigate', url: '/' },
          { action: 'click', selector: '{{linkSelector}}' },
          { action: 'assert', type: 'url', expected: '{{expectedUrl}}' }
        ]
      }
    };
  }

  async generateTests(description) {
    logger.info(`🤖 Generating AI tests for: "${description}"`);
    
    try {
      const tokens = this.tokenizer.tokenize(description.toLowerCase());
      const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
      
      const matchedPatterns = this.findMatchingPatterns(stemmedTokens);
      const generatedTests = [];

      for (const pattern of matchedPatterns) {
        const test = this.generateTestFromPattern(pattern, description);
        generatedTests.push(test);
      }

      // Generate additional tests using ML if model is available
      if (this.model) {
        const mlTests = await this.generateMLTests(description, stemmedTokens);
        generatedTests.push(...mlTests);
      }

      // Generate edge cases and negative tests
      const edgeCaseTests = this.generateEdgeCases(generatedTests);
      generatedTests.push(...edgeCaseTests);

      logger.info(`✅ Generated ${generatedTests.length} AI tests`);
      return generatedTests;

    } catch (error) {
      logger.error('❌ AI test generation failed:', error);
      throw error;
    }
  }

  findMatchingPatterns(tokens) {
    const matches = [];
    
    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      const score = this.calculatePatternScore(tokens, pattern.keywords);
      if (score > 0.3) { // Threshold for pattern matching
        matches.push({ name: patternName, pattern, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  calculatePatternScore(tokens, keywords) {
    let score = 0;
    const stemmedKeywords = keywords.map(kw => this.stemmer.stem(kw.toLowerCase()));
    
    for (const token of tokens) {
      for (const keyword of stemmedKeywords) {
        if (token === keyword) {
          score += 1;
        } else if (natural.JaroWinklerDistance(token, keyword) > 0.8) {
          score += 0.5;
        }
      }
    }

    return score / Math.max(tokens.length, keywords.length);
  }

  generateTestFromPattern(patternMatch, description) {
    const { name, pattern } = patternMatch;
    
    return {
      id: `ai_${name}_${Date.now()}`,
      name: `AI Generated: ${description}`,
      description: `Auto-generated test based on ${name} pattern`,
      type: 'ai-generated',
      pattern: name,
      confidence: patternMatch.score,
      steps: this.processSteps(pattern.steps, description),
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'ai-pattern-matching',
        originalDescription: description
      }
    };
  }

  processSteps(steps, description) {
    return steps.map(step => {
      const processedStep = { ...step };
      
      // Replace placeholders with intelligent values
      if (step.value && step.value.includes('{{')) {
        processedStep.value = this.replacePlaceholders(step.value, description);
      }
      
      if (step.url && step.url.includes('{{')) {
        processedStep.url = this.replacePlaceholders(step.url, description);
      }
      
      if (step.selector && step.selector.includes('{{')) {
        processedStep.selector = this.replacePlaceholders(step.selector, description);
      }

      return processedStep;
    });
  }

  replacePlaceholders(text, context) {
    const placeholders = {
      '{{username}}': 'testuser@example.com',
      '{{password}}': 'TestPassword123!',
      '{{email}}': `test${Date.now()}@example.com`,
      '{{searchTerm}}': this.extractSearchTerm(context),
      '{{formUrl}}': '/form',
      '{{fieldName}}': 'testField',
      '{{fieldValue}}': 'Test Value',
      '{{linkSelector}}': 'a[href*="test"]',
      '{{expectedUrl}}': '/test-page'
    };

    let result = text;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  }

  extractSearchTerm(description) {
    const tokens = this.tokenizer.tokenize(description);
    const searchWords = tokens.filter(token => 
      !['test', 'testing', 'search', 'for', 'the', 'a', 'an'].includes(token.toLowerCase())
    );
    
    return searchWords.length > 0 ? searchWords[0] : 'test';
  }

  async generateMLTests(description, tokens) {
    // Placeholder for ML-based test generation
    // In a real implementation, this would use a trained model
    logger.info('🧠 ML-based test generation not yet implemented');
    return [];
  }

  generateEdgeCases(baseTests) {
    const edgeCases = [];
    
    for (const test of baseTests) {
      // Generate negative test cases
      const negativeTest = this.createNegativeTest(test);
      if (negativeTest) {
        edgeCases.push(negativeTest);
      }

      // Generate boundary tests
      const boundaryTest = this.createBoundaryTest(test);
      if (boundaryTest) {
        edgeCases.push(boundaryTest);
      }
    }

    return edgeCases;
  }

  createNegativeTest(baseTest) {
    if (baseTest.pattern === 'login') {
      return {
        ...baseTest,
        id: `${baseTest.id}_negative`,
        name: `${baseTest.name} - Invalid Credentials`,
        steps: baseTest.steps.map(step => {
          if (step.action === 'fill' && step.selector.includes('password')) {
            return { ...step, value: 'wrongpassword' };
          }
          if (step.action === 'assert' && step.type === 'url') {
            return { ...step, expected: '/login', type: 'visible', selector: '.error-message' };
          }
          return step;
        }),
        metadata: {
          ...baseTest.metadata,
          testType: 'negative',
          expectedResult: 'failure'
        }
      };
    }

    return null;
  }

  createBoundaryTest(baseTest) {
    if (baseTest.pattern === 'form') {
      return {
        ...baseTest,
        id: `${baseTest.id}_boundary`,
        name: `${baseTest.name} - Boundary Values`,
        steps: baseTest.steps.map(step => {
          if (step.action === 'fill') {
            return { ...step, value: 'a'.repeat(255) }; // Max length test
          }
          return step;
        }),
        metadata: {
          ...baseTest.metadata,
          testType: 'boundary'
        }
      };
    }

    return null;
  }

  async generateFromDescription(description) {
    logger.info(`🎯 Generating comprehensive test suite from: "${description}"`);
    
    const tests = await this.generateTests(description);
    
    // Add test data variations
    const variations = this.generateTestDataVariations(tests);
    tests.push(...variations);

    // Add accessibility tests
    const a11yTests = this.generateAccessibilityTests(description);
    tests.push(...a11yTests);

    // Add performance tests
    const perfTests = this.generatePerformanceTests(description);
    tests.push(...perfTests);

    return {
      description,
      totalTests: tests.length,
      tests,
      categories: this.categorizeTests(tests),
      estimatedDuration: this.estimateTestDuration(tests),
      generatedAt: new Date().toISOString()
    };
  }

  generateTestDataVariations(baseTests) {
    // Generate tests with different data sets
    return [];
  }

  generateAccessibilityTests(description) {
    return [{
      id: `a11y_${Date.now()}`,
      name: `Accessibility Test: ${description}`,
      type: 'accessibility',
      steps: [
        { action: 'navigate', url: '/' },
        { action: 'custom', handler: 'checkAccessibility', params: { rules: ['wcag2a', 'wcag2aa'] } }
      ],
      metadata: {
        category: 'accessibility',
        generatedAt: new Date().toISOString()
      }
    }];
  }

  generatePerformanceTests(description) {
    return [{
      id: `perf_${Date.now()}`,
      name: `Performance Test: ${description}`,
      type: 'performance',
      steps: [
        { action: 'navigate', url: '/', options: { waitUntil: 'networkidle' } },
        { action: 'custom', handler: 'measurePerformance', params: { metrics: ['FCP', 'LCP', 'CLS'] } }
      ],
      metadata: {
        category: 'performance',
        generatedAt: new Date().toISOString()
      }
    }];
  }

  categorizeTests(tests) {
    const categories = {};
    
    for (const test of tests) {
      const category = test.metadata?.category || test.pattern || 'general';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(test.id);
    }

    return categories;
  }

  estimateTestDuration(tests) {
    // Rough estimation: 30 seconds per test on average
    return tests.length * 30;
  }
}

module.exports = { AITestGenerator };