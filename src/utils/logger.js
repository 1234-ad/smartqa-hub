const winston = require('winston');
const chalk = require('chalk');

// Custom format for console output with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const colorMap = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      debug: chalk.gray
    };
    
    const colorFn = colorMap[level] || chalk.white;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    
    return `${chalk.gray(timestamp)} ${colorFn(level.toUpperCase().padEnd(5))} ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/smartqa.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: 'logs/errors.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add test-specific logging methods
logger.testStart = (testName, testId) => {
  logger.info(`🧪 Test Started: ${testName}`, { testId, event: 'test_start' });
};

logger.testEnd = (testName, testId, status, duration) => {
  const emoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  logger.info(`${emoji} Test ${status}: ${testName} (${duration}ms)`, { 
    testId, 
    status, 
    duration, 
    event: 'test_end' 
  });
};

logger.testStep = (stepName, testId, status) => {
  const emoji = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '→';
  logger.debug(`  ${emoji} ${stepName}`, { testId, stepName, status, event: 'test_step' });
};

logger.apiRequest = (method, url, status, duration) => {
  const emoji = status >= 200 && status < 400 ? '🟢' : '🔴';
  logger.debug(`${emoji} ${method} ${url} → ${status} (${duration}ms)`, {
    method,
    url,
    status,
    duration,
    event: 'api_request'
  });
};

logger.visualDiff = (testId, pixelDiff, threshold) => {
  const passed = pixelDiff <= threshold;
  const emoji = passed ? '👁️✅' : '👁️❌';
  logger.info(`${emoji} Visual diff: ${pixelDiff.toFixed(2)}% (threshold: ${threshold}%)`, {
    testId,
    pixelDiff,
    threshold,
    passed,
    event: 'visual_diff'
  });
};

logger.performance = (metric, value, threshold) => {
  const passed = value <= threshold;
  const emoji = passed ? '⚡✅' : '⚡❌';
  logger.info(`${emoji} ${metric}: ${value}ms (threshold: ${threshold}ms)`, {
    metric,
    value,
    threshold,
    passed,
    event: 'performance'
  });
};

// Add structured logging for different test types
logger.ai = {
  generated: (count, pattern) => {
    logger.info(`🤖 Generated ${count} tests using ${pattern} pattern`, {
      count,
      pattern,
      event: 'ai_generation'
    });
  },
  
  confidence: (testId, confidence) => {
    logger.debug(`🎯 AI confidence: ${(confidence * 100).toFixed(1)}%`, {
      testId,
      confidence,
      event: 'ai_confidence'
    });
  }
};

logger.dashboard = {
  clientConnected: (clientId) => {
    logger.info(`📱 Dashboard client connected: ${clientId}`, {
      clientId,
      event: 'dashboard_connect'
    });
  },
  
  clientDisconnected: (clientId) => {
    logger.info(`📱 Dashboard client disconnected: ${clientId}`, {
      clientId,
      event: 'dashboard_disconnect'
    });
  },
  
  broadcast: (event, data) => {
    logger.debug(`📡 Broadcasting ${event}`, {
      event: 'dashboard_broadcast',
      broadcastEvent: event,
      dataSize: JSON.stringify(data).length
    });
  }
};

// Environment-specific configuration
if (process.env.NODE_ENV === 'production') {
  // In production, reduce console logging and increase file logging
  logger.transports.forEach(transport => {
    if (transport.name === 'console') {
      transport.level = 'warn';
    }
  });
} else if (process.env.NODE_ENV === 'test') {
  // In test environment, reduce logging noise
  logger.transports.forEach(transport => {
    if (transport.name === 'console') {
      transport.level = 'error';
    }
  });
}

// Add request ID tracking for better debugging
logger.withRequestId = (requestId) => {
  return logger.child({ requestId });
};

// Add test session tracking
logger.withSession = (sessionId) => {
  return logger.child({ sessionId });
};

module.exports = logger;