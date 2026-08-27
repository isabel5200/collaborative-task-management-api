import http from 'node:http';

const port = Number(process.env.WEBHOOK_MOCK_PORT || 4000);

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end();
    return;
  }

  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    console.info(
      JSON.stringify({
        idempotencyKey: req.headers['x-idempotency-key'],
        payload: JSON.parse(body),
      }),
    );
    res.writeHead(204).end();
  });
});

server.listen(port, '127.0.0.1', () => {
  console.info(`Mock webhook listening at http://127.0.0.1:${port}/webhooks/tasks`);
});
