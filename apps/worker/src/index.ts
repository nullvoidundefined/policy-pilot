import 'dotenv/config';

const { startWorker } = await import('app/workers/startWorker.js');
startWorker();
