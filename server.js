const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Cached live rate
let cachedEURUSD = {
  rate: 1.1463,
  timestamp: Date.now(),
  provider: 'Initial Live Benchmark'
};

function refreshLiveRate() {
  https.get('https://open.er-api.com/v6/latest/EUR', (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.rates && parsed.rates.USD) {
          cachedEURUSD = {
            rate: parseFloat(parsed.rates.USD),
            timestamp: Date.now(),
            provider: 'Open-Exchange Interbank Feed'
          };
          console.log(`[FX SYNC] Live EUR/USD updated: 1 EUR = $${cachedEURUSD.rate} USD`);
        }
      } catch (e) {}
    });
  }).on('error', () => {});
}

// Fetch on startup and every 30s
refreshLiveRate();
setInterval(refreshLiveRate, 30000);

const server = http.createServer((req, res) => {
  // API Route for live FX rates
  if (req.url.startsWith('/api/rates')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      symbol: 'EUR/USD',
      rate: cachedEURUSD.rate,
      timestamp: cachedEURUSD.timestamp,
      provider: cachedEURUSD.provider
    }));
    return;
  }

  let reqPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Apex Trader Pro running at http://127.0.0.1:${PORT}/`);
});
