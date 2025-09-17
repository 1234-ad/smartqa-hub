// Example test suite demonstrating SmartQA Hub capabilities

const loginTestSuite = {
  id: 'login_suite_001',
  name: 'User Authentication Tests',
  description: 'Comprehensive test suite for user login functionality',
  
  tests: [
    {
      id: 'login_valid_001',
      name: 'Valid Login Test',
      description: 'Test successful login with valid credentials',
      type: 'functional',
      priority: 'high',
      tags: ['login', 'authentication', 'smoke'],
      
      steps: [
        {
          name: 'Navigate to login page',
          action: 'navigate',
          url: '/login',
          waitUntil: 'networkidle'
        },
        {
          name: 'Enter username',
          action: 'fill',
          selector: '[data-testid="username"]',
          value: 'testuser@example.com'
        },
        {
          name: 'Enter password',
          action: 'fill',
          selector: '[data-testid="password"]',
          value: 'TestPassword123!'
        },
        {
          name: 'Click login button',
          action: 'click',
          selector: '[data-testid="login-button"]'
        },
        {
          name: 'Wait for dashboard',
          action: 'wait',
          selector: '[data-testid="dashboard"]',
          options: { timeout: 5000 }
        },
        {
          name: 'Verify successful login',
          action: 'assert',
          type: 'url',
          expected: '/dashboard'
        },
        {
          name: 'Verify user menu visible',
          action: 'assert',
          type: 'visible',
          selector: '[data-testid="user-menu"]',
          expected: true
        }
      ],
      
      cleanup: [
        {
          name: 'Logout user',
          action: 'click',
          selector: '[data-testid="logout-button"]'
        }
      ]
    },
    
    {
      id: 'login_invalid_001',
      name: 'Invalid Credentials Test',
      description: 'Test login failure with invalid credentials',
      type: 'negative',
      priority: 'high',
      tags: ['login', 'authentication', 'negative'],
      
      steps: [
        {
          name: 'Navigate to login page',
          action: 'navigate',
          url: '/login'
        },
        {
          name: 'Enter invalid username',
          action: 'fill',
          selector: '[data-testid="username"]',
          value: 'invalid@example.com'
        },
        {
          name: 'Enter invalid password',
          action: 'fill',
          selector: '[data-testid="password"]',
          value: 'wrongpassword'
        },
        {
          name: 'Click login button',
          action: 'click',
          selector: '[data-testid="login-button"]'
        },
        {
          name: 'Wait for error message',
          action: 'wait',
          selector: '[data-testid="error-message"]',
          options: { timeout: 3000 }
        },
        {
          name: 'Verify error message displayed',
          action: 'assert',
          type: 'visible',
          selector: '[data-testid="error-message"]',
          expected: true
        },
        {
          name: 'Verify error message text',
          action: 'assert',
          type: 'text',
          selector: '[data-testid="error-message"]',
          expected: 'Invalid username or password'
        },
        {
          name: 'Verify still on login page',
          action: 'assert',
          type: 'url',
          expected: '/login'
        }
      ]
    },
    
    {
      id: 'login_empty_001',
      name: 'Empty Fields Validation Test',
      description: 'Test form validation with empty fields',
      type: 'validation',
      priority: 'medium',
      tags: ['login', 'validation', 'form'],
      
      steps: [
        {
          name: 'Navigate to login page',
          action: 'navigate',
          url: '/login'
        },
        {
          name: 'Click login button without entering data',
          action: 'click',
          selector: '[data-testid="login-button"]'
        },
        {
          name: 'Verify username validation error',
          action: 'assert',
          type: 'visible',
          selector: '[data-testid="username-error"]',
          expected: true
        },
        {
          name: 'Verify password validation error',
          action: 'assert',
          type: 'visible',
          selector: '[data-testid="password-error"]',
          expected: true
        },
        {
          name: 'Enter username only',
          action: 'fill',
          selector: '[data-testid="username"]',
          value: 'testuser@example.com'
        },
        {
          name: 'Click login button',
          action: 'click',
          selector: '[data-testid="login-button"]'
        },
        {
          name: 'Verify password still required',
          action: 'assert',
          type: 'visible',
          selector: '[data-testid="password-error"]',
          expected: true
        }
      ]
    }
  ],
  
  // Visual regression tests
  visualTests: [
    {
      id: 'login_visual_001',
      name: 'Login Page Visual Test',
      description: 'Visual regression test for login page',
      url: '/login',
      viewport: { width: 1920, height: 1080 },
      fullPage: true,
      threshold: 0.1
    },
    {
      id: 'login_mobile_visual_001',
      name: 'Login Page Mobile Visual Test',
      description: 'Visual regression test for login page on mobile',
      url: '/login',
      viewport: { width: 375, height: 667 },
      fullPage: true,
      threshold: 0.1
    }
  ],
  
  // API tests
  apiTests: [
    {
      id: 'login_api_001',
      name: 'Login API Test',
      description: 'Test login API endpoint',
      
      steps: [
        {
          type: 'request',
          name: 'Login API call',
          method: 'POST',
          url: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            username: 'testuser@example.com',
            password: 'TestPassword123!'
          },
          saveAs: 'loginResponse'
        },
        {
          type: 'assertion',
          name: 'Verify successful response',
          assertion: {
            target: 'loginResponse',
            type: 'status',
            expected: 200
          }
        },
        {
          type: 'assertion',
          name: 'Verify response contains token',
          assertion: {
            target: 'loginResponse',
            type: 'body',
            path: 'token',
            expected: (value) => typeof value === 'string' && value.length > 0
          }
        },
        {
          type: 'assertion',
          name: 'Verify response schema',
          assertion: {
            target: 'loginResponse',
            type: 'schema',
            schema: {
              token: 'string',
              user: {
                id: 'number',
                email: 'string',
                name: 'string'
              },
              expiresIn: 'number'
            }
          }
        }
      ]
    }
  ],
  
  // Performance tests
  performanceTests: [
    {
      id: 'login_perf_001',
      name: 'Login Page Performance Test',
      description: 'Test login page load performance',
      url: '/login',
      metrics: ['FCP', 'LCP', 'CLS'],
      thresholds: {
        FCP: 2000,
        LCP: 4000,
        CLS: 0.1
      }
    }
  ],
  
  // Accessibility tests
  accessibilityTests: [
    {
      id: 'login_a11y_001',
      name: 'Login Page Accessibility Test',
      description: 'Test login page accessibility compliance',
      url: '/login',
      standards: ['wcag2a', 'wcag2aa'],
      rules: {
        'color-contrast': 'error',
        'keyboard-navigation': 'error',
        'aria-labels': 'error'
      }
    }
  ],
  
  // Test data
  testData: {
    validUsers: [
      {
        username: 'testuser@example.com',
        password: 'TestPassword123!',
        role: 'user'
      },
      {
        username: 'admin@example.com',
        password: 'AdminPassword123!',
        role: 'admin'
      }
    ],
    invalidUsers: [
      {
        username: 'invalid@example.com',
        password: 'wrongpassword'
      },
      {
        username: 'notfound@example.com',
        password: 'TestPassword123!'
      }
    ]
  },
  
  // Configuration
  config: {
    timeout: 30000,
    retries: 2,
    parallel: true,
    browsers: ['chromium', 'firefox'],
    environments: ['staging', 'production']
  }
};

module.exports = loginTestSuite;