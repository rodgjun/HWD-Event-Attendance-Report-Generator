export function errorMiddleware(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.details;
  res.status(status).json({ error: message, details });
}


