const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const logger = require('../utils/logger');

class Dashboard {
  constructor(config = {}) {
    this.config = {
      port: 3000,
      host: 'localhost',
      ...config
    };
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.testResults = [];
    this.activeTests = new Map();
    this.connectedClients = new Set();
    
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupRoutes() {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use(express.json());

    // API Routes
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.app.get('/api/results', (req, res) => {
      const { limit = 50, offset = 0, status, type } = req.query;
      
      let filteredResults = this.testResults;
      
      if (status) {
        filteredResults = filteredResults.filter(r => r.status === status);
      }
      
      if (type) {
        filteredResults = filteredResults.filter(r => r.type === type);
      }
      
      const paginatedResults = filteredResults
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      res.json({
        results: paginatedResults,
        total: filteredResults.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
    });

    this.app.get('/api/results/:id', (req, res) => {
      const result = this.testResults.find(r => r.id === req.params.id);
      
      if (!result) {
        return res.status(404).json({ error: 'Test result not found' });
      }
      
      res.json(result);
    });

    this.app.get('/api/stats', (req, res) => {
      const stats = this.generateStats();
      res.json(stats);
    });

    this.app.get('/api/active-tests', (req, res) => {
      const activeTests = Array.from(this.activeTests.values());
      res.json(activeTests);
    });

    this.app.post('/api/tests/:id/stop', (req, res) => {
      const testId = req.params.id;
      
      if (this.activeTests.has(testId)) {
        this.activeTests.delete(testId);
        this.io.emit('testStopped', { testId });
        res.json({ message: 'Test stopped successfully' });
      } else {
        res.status(404).json({ error: 'Active test not found' });
      }
    });

    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      this.connectedClients.add(socket.id);
      logger.info(`📱 Dashboard client connected: ${socket.id}`);
      
      // Send current stats to new client
      socket.emit('stats', this.generateStats());
      socket.emit('activeTests', Array.from(this.activeTests.values()));
      
      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        logger.info(`📱 Dashboard client disconnected: ${socket.id}`);
      });
      
      socket.on('requestStats', () => {
        socket.emit('stats', this.generateStats());
      });
      
      socket.on('requestResults', (filters) => {
        const filteredResults = this.filterResults(filters);
        socket.emit('results', filteredResults);
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`📊 Dashboard server started on http://${this.config.host}:${this.config.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('📊 Dashboard server stopped');
        resolve();
      });
    });
  }

  broadcastResults(results) {
    if (Array.isArray(results)) {
      this.testResults.push(...results);
    } else {
      this.testResults.push(results);
    }
    
    // Keep only last 1000 results to prevent memory issues
    if (this.testResults.length > 1000) {
      this.testResults = this.testResults.slice(-1000);
    }
    
    this.io.emit('newResults', results);
    this.io.emit('stats', this.generateStats());
  }

  broadcastTestStart(testInfo) {
    this.activeTests.set(testInfo.id, {
      ...testInfo,
      startTime: new Date().toISOString(),
      status: 'running'
    });
    
    this.io.emit('testStarted', testInfo);
    this.io.emit('activeTests', Array.from(this.activeTests.values()));
  }

  broadcastTestComplete(testId, result) {
    this.activeTests.delete(testId);
    
    this.io.emit('testCompleted', { testId, result });
    this.io.emit('activeTests', Array.from(this.activeTests.values()));
  }

  broadcastTestProgress(testId, progress) {
    if (this.activeTests.has(testId)) {
      const test = this.activeTests.get(testId);
      test.progress = progress;
      this.activeTests.set(testId, test);
      
      this.io.emit('testProgress', { testId, progress });
    }
  }

  generateStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recent24h = this.testResults.filter(r => new Date(r.timestamp || r.startTime) > last24h);
    const recent7d = this.testResults.filter(r => new Date(r.timestamp || r.startTime) > last7d);
    
    return {
      total: {
        tests: this.testResults.length,
        passed: this.testResults.filter(r => r.status === 'passed').length,
        failed: this.testResults.filter(r => r.status === 'failed').length,
        skipped: this.testResults.filter(r => r.status === 'skipped').length
      },
      last24h: {
        tests: recent24h.length,
        passed: recent24h.filter(r => r.status === 'passed').length,
        failed: recent24h.filter(r => r.status === 'failed').length,
        skipped: recent24h.filter(r => r.status === 'skipped').length
      },
      last7d: {
        tests: recent7d.length,
        passed: recent7d.filter(r => r.status === 'passed').length,
        failed: recent7d.filter(r => r.status === 'failed').length,
        skipped: recent7d.filter(r => r.status === 'skipped').length
      },
      activeTests: this.activeTests.size,
      connectedClients: this.connectedClients.size,
      testTypes: this.getTestTypeStats(),
      trends: this.generateTrends()
    };
  }

  getTestTypeStats() {
    const types = {};
    
    for (const result of this.testResults) {
      const type = result.type || 'unknown';
      if (!types[type]) {
        types[type] = { total: 0, passed: 0, failed: 0 };
      }
      
      types[type].total++;
      if (result.status === 'passed') types[type].passed++;
      if (result.status === 'failed') types[type].failed++;
    }
    
    return types;
  }

  generateTrends() {
    // Generate hourly trends for the last 24 hours
    const trends = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const hourResults = this.testResults.filter(r => {
        const resultTime = new Date(r.timestamp || r.startTime);
        return resultTime >= hourStart && resultTime < hourEnd;
      });
      
      trends.push({
        hour: hourStart.getHours(),
        total: hourResults.length,
        passed: hourResults.filter(r => r.status === 'passed').length,
        failed: hourResults.filter(r => r.status === 'failed').length
      });
    }
    
    return trends;
  }

  filterResults(filters = {}) {
    let filtered = this.testResults;
    
    if (filters.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    
    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }
    
    if (filters.timeRange) {
      const cutoff = new Date(Date.now() - filters.timeRange * 60 * 60 * 1000);
      filtered = filtered.filter(r => new Date(r.timestamp || r.startTime) > cutoff);
    }
    
    return filtered.slice(0, filters.limit || 100);
  }

  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartQA Hub Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.5rem; font-weight: bold; }
        .status { display: flex; gap: 1rem; }
        .status-item { text-align: center; }
        .status-value { font-size: 1.2rem; font-weight: bold; }
        .status-label { font-size: 0.8rem; opacity: 0.8; }
        .container { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
        .card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card h3 { margin-bottom: 1rem; color: #2c3e50; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .metric-value { font-weight: bold; }
        .passed { color: #27ae60; }
        .failed { color: #e74c3c; }
        .skipped { color: #f39c12; }
        .running { color: #3498db; }
        .test-list { max-height: 400px; overflow-y: auto; }
        .test-item { padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .test-name { font-weight: 500; }
        .test-status { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: white; }
        .status-passed { background: #27ae60; }
        .status-failed { background: #e74c3c; }
        .status-running { background: #3498db; }
        .status-skipped { background: #f39c12; }
        .chart { height: 200px; background: #ecf0f1; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🚀 SmartQA Hub</div>
        <div class="status">
            <div class="status-item">
                <div class="status-value" id="total-tests">0</div>
                <div class="status-label">Total Tests</div>
            </div>
            <div class="status-item">
                <div class="status-value passed" id="passed-tests">0</div>
                <div class="status-label">Passed</div>
            </div>
            <div class="status-item">
                <div class="status-value failed" id="failed-tests">0</div>
                <div class="status-label">Failed</div>
            </div>
            <div class="status-item">
                <div class="status-value running" id="active-tests">0</div>
                <div class="status-label">Active</div>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="grid">
            <div class="card">
                <h3>📊 Test Statistics</h3>
                <div class="metric">
                    <span>Pass Rate:</span>
                    <span class="metric-value passed" id="pass-rate">0%</span>
                </div>
                <div class="metric">
                    <span>Last 24h:</span>
                    <span class="metric-value" id="last-24h">0 tests</span>
                </div>
                <div class="metric">
                    <span>Last 7d:</span>
                    <span class="metric-value" id="last-7d">0 tests</span>
                </div>
                <div class="metric">
                    <span>Connected Clients:</span>
                    <span class="metric-value" id="connected-clients">0</span>
                </div>
            </div>

            <div class="card">
                <h3>🔄 Active Tests</h3>
                <div class="test-list" id="active-tests-list">
                    <div style="text-align: center; color: #7f8c8d; padding: 2rem;">No active tests</div>
                </div>
            </div>

            <div class="card">
                <h3>📈 Test Trends</h3>
                <div class="chart" id="trends-chart">
                    Trends chart will appear here
                </div>
            </div>
        </div>

        <div class="card">
            <h3>📋 Recent Test Results</h3>
            <div class="test-list" id="recent-results">
                <div style="text-align: center; color: #7f8c8d; padding: 2rem;">No test results yet</div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        
        socket.on('stats', (stats) => {
            updateStats(stats);
        });
        
        socket.on('activeTests', (tests) => {
            updateActiveTests(tests);
        });
        
        socket.on('newResults', (results) => {
            updateRecentResults(results);
        });
        
        socket.on('testStarted', (test) => {
            console.log('Test started:', test);
        });
        
        socket.on('testCompleted', (data) => {
            console.log('Test completed:', data);
        });
        
        function updateStats(stats) {
            document.getElementById('total-tests').textContent = stats.total.tests;
            document.getElementById('passed-tests').textContent = stats.total.passed;
            document.getElementById('failed-tests').textContent = stats.total.failed;
            document.getElementById('active-tests').textContent = stats.activeTests;
            document.getElementById('connected-clients').textContent = stats.connectedClients;
            
            const passRate = stats.total.tests > 0 ? 
                ((stats.total.passed / stats.total.tests) * 100).toFixed(1) : 0;
            document.getElementById('pass-rate').textContent = passRate + '%';
            
            document.getElementById('last-24h').textContent = stats.last24h.tests + ' tests';
            document.getElementById('last-7d').textContent = stats.last7d.tests + ' tests';
        }
        
        function updateActiveTests(tests) {
            const container = document.getElementById('active-tests-list');
            
            if (tests.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 2rem;">No active tests</div>';
                return;
            }
            
            container.innerHTML = tests.map(test => \`
                <div class="test-item">
                    <div class="test-name">\${test.name}</div>
                    <div class="test-status status-running">Running</div>
                </div>
            \`).join('');
        }
        
        function updateRecentResults(results) {
            const container = document.getElementById('recent-results');
            
            if (!Array.isArray(results)) {
                results = [results];
            }
            
            const html = results.map(result => \`
                <div class="test-item">
                    <div class="test-name">\${result.name || result.id}</div>
                    <div class="test-status status-\${result.status}">\${result.status}</div>
                </div>
            \`).join('');
            
            container.innerHTML = html + container.innerHTML;
            
            // Keep only last 20 results visible
            const items = container.children;
            while (items.length > 20) {
                container.removeChild(items[items.length - 1]);
            }
        }
        
        // Request initial data
        socket.emit('requestStats');
    </script>
</body>
</html>
    `;
  }
}

module.exports = { Dashboard };