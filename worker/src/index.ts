import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

await loadSecrets();

await import("./workers.js");
