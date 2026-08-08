/**
 * Loads .env.local before anything else.
 *
 * Import this FIRST in any CLI script that touches src/lib/config. ES modules
 * evaluate dependencies in import order, so a side-effect module placed above
 * the others is the only reliable way to populate process.env before
 * config.ts reads it at module scope — calling dotenv inline does not work,
 * because static imports are hoisted above the call.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
