const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Ошибки валидации
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  // Ошибки JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Ошибки базы данных
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Duplicate entry',
      details: 'A record with this information already exists'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Reference error',
      details: 'Referenced record does not exist'
    });
  }

  // Ошибки Axios (API calls)
  if (err.isAxiosError) {
    return res.status(err.response?.status || 500).json({
      error: 'External API error',
      details: err.response?.data?.message || err.message
    });
  }

  // Ошибки по умолчанию
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };



