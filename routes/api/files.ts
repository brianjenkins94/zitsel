import { spawnSync } from "child_process";
import { existsSync, promises as fs } from "fs";
import path from "path";

export async function get(request, response) {
	const files = Object.fromEntries(await Promise.all(spawnSync("git", ["ls-files"], {
		"encoding": "utf8",
		"shell": process.platform === "win32" ? path.join(process.env["ProgramW6432"], "Git", "usr", "bin", "bash.exe") : true
	}).stdout.trim().split("\n").filter(function(filePath) {
		return !filePath.startsWith(".") && existsSync(filePath);
	}).map(async function(fileName) {
		return [fileName, await fs.readFile(fileName, { "encoding": "utf8" })];
	})));

	response.json({
		...files,
		"package.json": JSON.stringify({
			"type": "module",
			"dependencies": {
				"express": "latest"
			}
		}),
		"index.js": `
			import express from "express";
			import { promises as fs } from "fs";
			import * as path from "path";
			import * as url from "url";

			// These appear to break the Nodebox:
			//const __filename = url.fileURLToPath(import.meta.url);
			//const __dirname = path.dirname(__filename);

			const BASE_URL = "http://localhost:8000";

			export const server = express();

			server.set("json spaces", 4);

			server.get("/", function(request, response) {
				response.send(\`
					<!DOCTYPE html>
					<html lang="en">
					<head>
						<meta charset="utf-8" />
						<meta name="description" content="" />
						<meta name="viewport" content="width=device-width, initial-scale=1" />
						<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/modern-normalize/modern-normalize.min.css" />
						<link rel="stylesheet" href="/css/style.css" />
					</head>
					<body>
						<script src="/js/main.js" type="module"></script>
					</body>
					</html>
				\`);
			});

			server.get("/js/main.js", async function(request, response) {
				// Despite setting the type, the browser console shows the error:
				// > Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "application/octet-stream". Strict MIME type checking is enforced for module scripts per HTML spec.
				response.type("text/javascript");

				// response.sendFile() would not work.
				response.send(await fs.readFile("public/js/main.js"));
			});

			server.listen(new URL(BASE_URL).port, function() {
				console.log("> Ready on " + BASE_URL);
			});
		`
	});
}
