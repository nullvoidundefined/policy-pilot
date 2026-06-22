/** Starts the minimal HTTP health-check server Railway probes to confirm the worker process is live. */
import http from 'node:http';
import type { Server } from 'node:http';

const DEFAULT_HEALTH_PORT = 3002;
const HEALTH_OK_BODY = 'ok';

export function startHealthServer(): Server {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end(HEALTH_OK_BODY);
  });
  server.listen(
    Number(process.env.PORT || process.env.WORKER_PORT) || DEFAULT_HEALTH_PORT,
  );
  return server;
}
