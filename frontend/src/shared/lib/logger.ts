import log from 'loglevel';

// Use standard JSON format so we can ship it
const originalFactory = log.methodFactory;

log.methodFactory = function (methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);

  return function (message: any, ...args: any[]) {
    const timestamp = new Date().toISOString();
    
    // Log to standard console
    rawMethod(`[${timestamp}] [${methodName.toUpperCase()}] ${message}`, ...args);
    
    // Ship to Backend if not running locally, or for our diagnostic purposes
    fetch('http://localhost:8000/api/diagnostics/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: methodName,
            timestamp,
            message: message,
            context: args.length > 0 ? args : undefined
        })
    }).catch(() => { /* Silent fail if tracking server down */ });
  };
};

log.setLevel(log.levels.DEBUG); // Set logging level

export const logger = log;
