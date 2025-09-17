# Getting Started with SmartQA Hub

Welcome to SmartQA Hub - the next-generation QA testing framework that combines AI-powered test generation, visual regression testing, comprehensive API testing, and real-time analytics.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm 8+
- Git
- Modern web browser (Chrome, Firefox, or Safari)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/1234-ad/smartqa-hub.git
   cd smartqa-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install
   ```

4. **Start the dashboard**
   ```bash
   npm run dashboard
   ```

5. **Run sample tests**
   ```bash
   npm test
   ```

## 📖 Basic Usage

### Running Tests

SmartQA Hub provides multiple ways to run tests:

```bash
# Run all tests
npm test

# Run specific test suite
node src/index.js test login-suite

# Run with specific test types
node src/index.js test login-suite --visual --api --ai

# Start dashboard only
npm run dashboard
```

### Creating Your First Test

1. **Create a test file** in the `tests/` directory:

```javascript
// tests/my-first-test.js
const myTest = {
  id: 'my_test_001',
  name: 'My First Test',
  description: 'A simple test to get started',
  
  steps: [
    {
      name: 'Navigate to homepage',
      action: 'navigate',
      url: 'https://example.com'
    },
    {
      name: 'Check page title',
      action: 'assert',
      type: 'text',
      selector: 'title',
      expected: 'Example Domain'
    }
  ]
};

module.exports = myTest;
```

2. **Run your test**:
```bash
node src/index.js test my-first-test
```

## 🤖 AI Test Generation

SmartQA Hub can automatically generate tests from natural language descriptions:

```bash
# Generate tests from description
node src/index.js generate "test user login with valid credentials"

# Generate comprehensive test suite
node src/index.js generate "test e-commerce checkout process"
```

### AI Generation Examples

```javascript
const { SmartQAHub } = require('./src/index');

const hub = new SmartQAHub();
await hub.initialize();

// Generate tests from description
const tests = await hub.generateAITests("test user registration form");

// The AI will generate:
// - Positive test cases
// - Negative test cases  
// - Edge cases
// - Validation tests
// - Accessibility tests
```

## 👁️ Visual Regression Testing

Set up visual regression testing for your application:

1. **Create baseline images**:
```bash
npm run test:visual -- --create-baseline
```

2. **Run visual tests**:
```bash
npm run test:visual
```

3. **Update baselines** when UI changes are intentional:
```bash
npm run test:visual -- --update-baseline
```

### Visual Test Configuration

```javascript
const visualTest = {
  id: 'homepage_visual',
  name: 'Homepage Visual Test',
  url: '/homepage',
  viewport: { width: 1920, height: 1080 },
  threshold: 0.1, // 0.1% pixel difference allowed
  fullPage: true
};
```

## 🔌 API Testing

Create comprehensive API test suites:

```javascript
const apiTest = {
  id: 'user_api_test',
  name: 'User API Tests',
  
  steps: [
    {
      type: 'request',
      name: 'Create user',
      method: 'POST',
      url: '/api/users',
      data: {
        name: 'Test User',
        email: 'test@example.com'
      },
      saveAs: 'createUserResponse'
    },
    {
      type: 'assertion',
      name: 'Verify user created',
      assertion: {
        target: 'createUserResponse',
        type: 'status',
        expected: 201
      }
    }
  ]
};
```

## 📊 Dashboard Usage

The real-time dashboard provides:

- **Live test execution monitoring**
- **Test result analytics**
- **Performance metrics**
- **Visual diff comparisons**
- **Test trends and statistics**

Access the dashboard at: `http://localhost:3000`

### Dashboard Features

- 📈 **Real-time metrics**: See test results as they happen
- 🔍 **Detailed test reports**: Drill down into individual test results
- 📊 **Analytics**: Track test trends and performance over time
- 🎯 **Filtering**: Filter results by status, type, or time range
- 📱 **Responsive design**: Works on desktop and mobile

## ⚙️ Configuration

Customize SmartQA Hub through the `config/default.json` file:

```json
{
  "browsers": ["chromium", "firefox"],
  "headless": true,
  "timeout": 30000,
  "ai": {
    "enabled": true,
    "confidenceThreshold": 0.3
  },
  "visual": {
    "threshold": 0.1,
    "baselineDir": "./tests/visual/baselines"
  },
  "dashboard": {
    "port": 3000,
    "realtime": true
  }
}
```

## 🔧 Environment Setup

### Development Environment

```bash
# Install development dependencies
npm install --dev

# Run in development mode with auto-reload
npm run dev

# Run linting
npm run lint

# Run tests with coverage
npm run test:coverage
```

### CI/CD Integration

SmartQA Hub integrates seamlessly with popular CI/CD platforms:

#### GitHub Actions
```yaml
name: QA Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install
      - run: npm test
```

#### Jenkins
```groovy
pipeline {
    agent any
    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
    }
}
```

## 📝 Best Practices

### Test Organization

1. **Group related tests** into suites
2. **Use descriptive names** for tests and steps
3. **Include cleanup steps** to maintain test isolation
4. **Tag tests** for easy filtering and organization

### Test Data Management

```javascript
// Use external test data files
const testData = require('../data/users.json');

const test = {
  steps: [
    {
      action: 'fill',
      selector: '[name="email"]',
      value: testData.validUser.email
    }
  ]
};
```

### Page Object Pattern

```javascript
// pages/LoginPage.js
class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = '[data-testid="username"]';
    this.passwordInput = '[data-testid="password"]';
    this.loginButton = '[data-testid="login-button"]';
  }
  
  async login(username, password) {
    await this.page.fill(this.usernameInput, username);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.loginButton);
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Browser installation fails**
   ```bash
   # Try manual installation
   npx playwright install chromium
   ```

2. **Tests timeout**
   - Increase timeout in configuration
   - Check network connectivity
   - Verify selectors are correct

3. **Visual tests fail unexpectedly**
   - Check for dynamic content
   - Verify viewport settings
   - Consider increasing threshold

4. **Dashboard not accessible**
   - Check port availability
   - Verify firewall settings
   - Check console for errors

### Debug Mode

Enable debug logging:

```bash
DEBUG=smartqa:* npm test
```

Or set log level in configuration:

```json
{
  "logging": {
    "level": "debug"
  }
}
```

## 📚 Next Steps

- [AI Test Generation Guide](ai-testing.md)
- [Visual Testing Guide](visual-testing.md)
- [API Testing Guide](api-testing.md)
- [Dashboard Usage](dashboard.md)
- [Advanced Configuration](configuration.md)
- [CI/CD Integration](ci-cd.md)

## 🤝 Getting Help

- 📖 [Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/1234-ad/smartqa-hub/issues)
- 💬 [Discussions](https://github.com/1234-ad/smartqa-hub/discussions)
- 📧 [Contact Support](mailto:support@smartqa-hub.com)

---

Ready to revolutionize your QA testing? Let's get started! 🚀