const { pool } = require('../config/database');

class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  async log(level, message, options = {}) {
    const {
      service = 'general',
      userId = null,
      ipAddress = null,
      userAgent = null,
      requestId = null,
      metadata = {}
    } = options;

    try {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO server_logs (level, message, service, user_id, ip_address, user_agent, request_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [level, message, service, userId, ipAddress, userAgent, requestId, JSON.stringify(metadata)]
        );
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Failed to write log to database:', err);
    }

    // Также выводим в консоль
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage, metadata);
        break;
      case 'warn':
        console.warn(logMessage, metadata);
        break;
      case 'info':
        console.info(logMessage, metadata);
        break;
      case 'debug':
        console.debug(logMessage, metadata);
        break;
      default:
        console.log(logMessage, metadata);
    }
  }

  async error(message, options = {}) {
    return this.log('error', message, options);
  }

  async warn(message, options = {}) {
    return this.log('warn', message, options);
  }

  async info(message, options = {}) {
    return this.log('info', message, options);
  }

  async debug(message, options = {}) {
    return this.log('debug', message, options);
  }

  // Метод для получения логов
  async getLogs(filters = {}) {
    const {
      level = null,
      service = null,
      userId = null,
      startDate = null,
      endDate = null,
      page = 1,
      limit = 100
    } = filters;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (level) {
      whereClause += ` AND level = $${paramIndex}`;
      queryParams.push(level);
      paramIndex++;
    }

    if (service) {
      whereClause += ` AND service = $${paramIndex}`;
      queryParams.push(service);
      paramIndex++;
    }

    if (userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    try {
      const client = await pool.connect();
      try {
        // Получаем логи
        const logsResult = await client.query(
          `SELECT sl.*, u.email, u.first_name, u.last_name
           FROM server_logs sl
           LEFT JOIN users u ON sl.user_id = u.id
           ${whereClause}
           ORDER BY sl.created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...queryParams, limit, offset]
        );

        // Получаем общее количество
        const countResult = await client.query(
          `SELECT COUNT(*) as total
           FROM server_logs sl
           LEFT JOIN users u ON sl.user_id = u.id
           ${whereClause}`,
          queryParams
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        return {
          logs: logsResult.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        };
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Failed to get logs:', err);
      throw err;
    }
  }

  // Метод для получения логов клиента
  async getClientLogs(filters = {}) {
    const {
      userId = null,
      level = null,
      component = null,
      action = null,
      startDate = null,
      endDate = null,
      page = 1,
      limit = 100
    } = filters;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (userId) {
      whereClause += ` AND cl.user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    if (level) {
      whereClause += ` AND cl.level = $${paramIndex}`;
      queryParams.push(level);
      paramIndex++;
    }

    if (component) {
      whereClause += ` AND cl.component = $${paramIndex}`;
      queryParams.push(component);
      paramIndex++;
    }

    if (action) {
      whereClause += ` AND cl.action = $${paramIndex}`;
      queryParams.push(action);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND cl.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND cl.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    try {
      const client = await pool.connect();
      try {
        // Получаем логи клиента
        const logsResult = await client.query(
          `SELECT cl.*, u.email, u.first_name, u.last_name
           FROM client_logs cl
           LEFT JOIN users u ON cl.user_id = u.id
           ${whereClause}
           ORDER BY cl.created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...queryParams, limit, offset]
        );

        // Получаем общее количество
        const countResult = await client.query(
          `SELECT COUNT(*) as total
           FROM client_logs cl
           LEFT JOIN users u ON cl.user_id = u.id
           ${whereClause}`,
          queryParams
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        return {
          logs: logsResult.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        };
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Failed to get client logs:', err);
      throw err;
    }
  }
}

module.exports = new Logger();





