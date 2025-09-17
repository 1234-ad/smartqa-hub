const axios = require('axios');
const Joi = require('joi');
const logger = require('../utils/logger');

class APITester {
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      validateSchema: true,
      captureHeaders: true,
      captureBody: true,
      ...config
    };
    
    this.client = axios.create({
      timeout: this.config.timeout,
      validateStatus: () => true // Don't throw on HTTP error status
    });
    
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        logger.debug(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug(`✅ API Response: ${response.status} (${duration}ms)`);
        response.metadata = { duration };
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
        logger.debug(`❌ API Error: ${error.message} (${duration}ms)`);
        if (error.response) {
          error.response.metadata = { duration };
        }
        return Promise.reject(error);
      }
    );
  }

  async runTests(testSuite = []) {
    logger.info('🔌 Running API tests...');
    
    const results = [];
    
    for (const test of testSuite) {
      try {
        const result = await this.runAPITest(test);
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

    logger.info(`✅ API tests completed: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
    return results;
  }

  async runAPITest(test) {
    const testResult = {
      id: test.id,
      name: test.name,
      type: 'api',
      status: 'running',
      startTime: new Date().toISOString(),
      requests: [],
      assertions: []
    };

    try {
      // Execute test steps
      for (const step of test.steps || []) {
        const stepResult = await this.executeAPIStep(step, testResult);
        
        if (stepResult.type === 'request') {
          testResult.requests.push(stepResult);
        } else if (stepResult.type === 'assertion') {
          testResult.assertions.push(stepResult);
        }
        
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
    }

    return testResult;
  }

  async executeAPIStep(step, testContext) {
    const stepResult = {
      name: step.name,
      type: step.type,
      startTime: new Date().toISOString(),
      status: 'running'
    };

    try {
      switch (step.type) {
        case 'request':
          const response = await this.makeRequest(step, testContext);
          stepResult.request = this.sanitizeRequest(step);
          stepResult.response = this.sanitizeResponse(response);
          stepResult.duration = response.metadata?.duration || 0;
          
          // Store response for later use in test
          if (step.saveAs) {
            testContext[step.saveAs] = response;
          }
          break;

        case 'assertion':
          await this.executeAssertion(step, testContext);
          stepResult.assertion = step.assertion;
          break;

        case 'wait':
          await this.wait(step.duration || 1000);
          break;

        case 'setup':
          await this.executeSetup(step, testContext);
          break;

        case 'cleanup':
          await this.executeCleanup(step, testContext);
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
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

  async makeRequest(step, testContext) {
    const config = {
      method: step.method || 'GET',
      url: this.interpolateVariables(step.url, testContext),
      headers: this.interpolateVariables(step.headers || {}, testContext),
      data: this.interpolateVariables(step.data, testContext),
      params: this.interpolateVariables(step.params, testContext),
      ...step.options
    };

    let attempt = 0;
    let lastError;

    while (attempt < this.config.retries) {
      try {
        const response = await this.client(config);
        
        // Validate response schema if provided
        if (step.responseSchema && this.config.validateSchema) {
          await this.validateResponseSchema(response.data, step.responseSchema);
        }

        return response;
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt < this.config.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Request failed, retrying in ${delay}ms... (attempt ${attempt}/${this.config.retries})`);
          await this.wait(delay);
        }
      }
    }

    throw lastError;
  }

  async executeAssertion(step, testContext) {
    const { assertion } = step;
    const response = testContext[assertion.target] || testContext.lastResponse;

    if (!response) {
      throw new Error(`No response found for assertion target: ${assertion.target}`);
    }

    switch (assertion.type) {
      case 'status':
        if (response.status !== assertion.expected) {
          throw new Error(`Status assertion failed. Expected: ${assertion.expected}, Got: ${response.status}`);
        }
        break;

      case 'header':
        const headerValue = response.headers[assertion.header.toLowerCase()];
        if (headerValue !== assertion.expected) {
          throw new Error(`Header assertion failed. Expected: ${assertion.expected}, Got: ${headerValue}`);
        }
        break;

      case 'body':
        const actualValue = this.getNestedValue(response.data, assertion.path);
        if (actualValue !== assertion.expected) {
          throw new Error(`Body assertion failed. Expected: ${assertion.expected}, Got: ${actualValue}`);
        }
        break;

      case 'schema':
        await this.validateResponseSchema(response.data, assertion.schema);
        break;

      case 'performance':
        const duration = response.metadata?.duration || 0;
        if (duration > assertion.maxDuration) {
          throw new Error(`Performance assertion failed. Expected: <${assertion.maxDuration}ms, Got: ${duration}ms`);
        }
        break;

      case 'custom':
        if (typeof assertion.validator === 'function') {
          const result = await assertion.validator(response, testContext);
          if (!result.valid) {
            throw new Error(`Custom assertion failed: ${result.message}`);
          }
        }
        break;

      default:
        throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }

  async validateResponseSchema(data, schema) {
    try {
      const joiSchema = typeof schema === 'object' ? Joi.object(schema) : schema;
      await joiSchema.validateAsync(data);
    } catch (error) {
      throw new Error(`Schema validation failed: ${error.message}`);
    }
  }

  interpolateVariables(obj, context) {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return context[key] !== undefined ? context[key] : match;
      });
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateVariables(item, context));
    }
    
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateVariables(value, context);
      }
      return result;
    }
    
    return obj;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  sanitizeRequest(request) {
    const sanitized = { ...request };
    
    // Remove sensitive data
    if (sanitized.headers && sanitized.headers.authorization) {
      sanitized.headers.authorization = '[REDACTED]';
    }
    
    if (sanitized.data && sanitized.data.password) {
      sanitized.data = { ...sanitized.data, password: '[REDACTED]' };
    }
    
    return sanitized;
  }

  sanitizeResponse(response) {
    if (!this.config.captureBody && !this.config.captureHeaders) {
      return { status: response.status, statusText: response.statusText };
    }
    
    const sanitized = {
      status: response.status,
      statusText: response.statusText
    };
    
    if (this.config.captureHeaders) {
      sanitized.headers = response.headers;
    }
    
    if (this.config.captureBody) {
      sanitized.data = response.data;
    }
    
    return sanitized;
  }

  async executeSetup(step, testContext) {
    // Execute setup operations like creating test data
    if (step.handler && typeof step.handler === 'function') {
      await step.handler(testContext);
    }
  }

  async executeCleanup(step, testContext) {
    // Execute cleanup operations like deleting test data
    if (step.handler && typeof step.handler === 'function') {
      await step.handler(testContext);
    }
  }

  async wait(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  // Load testing capabilities
  async runLoadTest(test, options = {}) {
    const {
      concurrency = 10,
      duration = 60000,
      rampUp = 5000
    } = options;

    logger.info(`🚀 Running load test: ${test.name} (${concurrency} concurrent users)`);
    
    const results = {
      testName: test.name,
      startTime: new Date().toISOString(),
      concurrency,
      duration,
      requests: [],
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestsPerSecond: 0
      }
    };

    const startTime = Date.now();
    const endTime = startTime + duration;
    const workers = [];

    // Ramp up workers gradually
    for (let i = 0; i < concurrency; i++) {
      setTimeout(() => {
        const worker = this.createLoadTestWorker(test, endTime, results);
        workers.push(worker);
      }, (i * rampUp) / concurrency);
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate summary statistics
    this.calculateLoadTestSummary(results);
    
    results.endTime = new Date().toISOString();
    results.actualDuration = Date.now() - startTime;

    logger.info(`✅ Load test completed: ${results.summary.totalRequests} requests, ${results.summary.requestsPerSecond.toFixed(2)} req/s`);
    
    return results;
  }

  async createLoadTestWorker(test, endTime, results) {
    while (Date.now() < endTime) {
      try {
        const response = await this.makeRequest(test.steps[0], {});
        
        results.requests.push({
          timestamp: new Date().toISOString(),
          status: response.status,
          duration: response.metadata?.duration || 0,
          success: response.status >= 200 && response.status < 400
        });
        
      } catch (error) {
        results.requests.push({
          timestamp: new Date().toISOString(),
          status: 0,
          duration: 0,
          success: false,
          error: error.message
        });
      }
      
      // Small delay between requests
      await this.wait(100);
    }
  }

  calculateLoadTestSummary(results) {
    const { requests } = results;
    const successful = requests.filter(r => r.success);
    const durations = requests.map(r => r.duration);
    
    results.summary.totalRequests = requests.length;
    results.summary.successfulRequests = successful.length;
    results.summary.failedRequests = requests.length - successful.length;
    results.summary.averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    results.summary.minResponseTime = Math.min(...durations);
    results.summary.maxResponseTime = Math.max(...durations);
    results.summary.requestsPerSecond = (requests.length / (results.actualDuration / 1000));
  }
}

module.exports = { APITester };