const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let PORT = 3000;
const filePath = path.join(__dirname, 'index.html');

function startServer(port) {
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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} dang duoc su dung, tu dong chuyen sang port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });

  server.listen(port, () => {
    console.log("========================================================");
    console.log(" UNIVERSAL CHECKOUT — WEB CHECKOUT DEMO IS RUNNING");
    console.log(` URL: http://localhost:${port}`);
    console.log("========================================================");
    exec(`start http://localhost:${port}`);
  });
}

startServer(PORT);
