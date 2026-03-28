import { loadSecrets } from 'app/config/secrets.js';
import 'dotenv/config';

// Must run before any app modules are imported — static imports are hoisted,
// so all app code lives in workers.ts and is loaded via dynamic import below.
await loadSecrets();

await import('app/workers.js');
