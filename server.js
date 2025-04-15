// This file runs before Next.js server starts
const path = require('path');

// Import environment variables
require('dotenv').config();

// This will run after Next.js has initialized
console.log('Server starting up, modules will be loaded during normal initialization');

// Start the Next.js server
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3005, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3005');
  });
}); 