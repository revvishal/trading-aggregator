const { createProxyMiddleware } = require('http-proxy-middleware');
const API_BASE = process.env.REACT_APP_API_URL || '';
module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: `${API_BASE}`,
      changeOrigin: true,
    })
  );
};

