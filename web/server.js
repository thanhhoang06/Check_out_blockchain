const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const filePath = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading index.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("========================================================");
  console.log(" UNIVERSAL CHECKOUT — WEB CHECKOUT DEMO IS RUNNING");
  console.log(` Open in your browser: http://localhost:${PORT}`);
  console.log("========================================================");
  exec(`start http://localhost:${PORT}`);
});
