const logger = require('../services/logger');
const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  const startTime = Date.now();
  
  // Логируем начало запроса
  logger.info('Request started', {
    service: 'http',
    userId: req.user?.id || null,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestId,
    metadata: {
      method: req.method,
      url: req.originalUrl,
      headers: {
        'content-type': req.get('Content-Type'),
        'authorization': req.get('Authorization') ? 'Bearer ***' : undefined
      }
    }
  });

  // Перехватываем ответ
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Логируем завершение запроса
    logger.info('Request completed', {
      service: 'http',
      userId: req.user?.id || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestId,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        responseSize: data ? data.length : 0
      }
    });

    // Если ошибка, логируем как error
    if (res.statusCode >= 400) {
      logger.error('Request failed', {
        service: 'http',
        userId: req.user?.id || null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestId,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          error: data
        }
      });
    }

    originalSend.call(this, data);
  };

  next();
};

module.exports = requestLogger;
