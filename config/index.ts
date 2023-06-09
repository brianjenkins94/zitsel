import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const __root = path.join(__dirname, "..");

export const isCI = Boolean(process.env["CI"]);

export const isProd = process.env["NODE_ENV"] === "production";
