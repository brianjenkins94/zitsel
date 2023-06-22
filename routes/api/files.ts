import { spawnSync } from "child_process";
import { existsSync, promises as fs } from "fs";
import path from "path";

import { __root } from "../../config";

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
				"path-to-regexp": "latest"
			}
		}),
		"index.js": `
			import { match, pathToRegexp as pathToRegExp } from "path-to-regexp";
			import * as http from "http";
			import { promises as fs } from "fs";
			import * as path from "path";
			import * as url from "url";

			const location = new URL(".", globalThis.location.href.endsWith("/") ? globalThis.location.href.slice(0, -1) : globalThis.location.href);
			const BASE_URL = location.origin;
			const BASE_PATH = location.pathname;

			const router = {
				[BASE_PATH + "/"]: function(request, response) {
					return {
						"statusCode": 200,
						"headers": {
							"Content-Type": "text/html"
						},
						"body": \`
							<!DOCTYPE html>
							<html lang="en">
								<head>
									<link href="https://cdn.jsdelivr.net/npm/modern-normalize/modern-normalize.min.css" rel="stylesheet">
									<script src="/js/main.js" type="module"></script>
								</head>
								<body></body>
							</html>
						\`.trim()
					};
				},
				[BASE_PATH + "/js/main.js"]: async function(request, response) {
					return {
						"statusCode": 200,
						"headers": {
							"Content-Type": "text/javascript"
						},
						"body": await fs.readFile("public/js/main.js")
					};
				}
			};

			const server = http.createServer(async function(request, response) {
				const startTime = performance.now();

				const originalUrl = request.url;

				response.on("finish", function() {
					console.log(request.method, originalUrl, response.statusCode, (performance.now() - startTime).toFixed(3), "ms");
				});

				let statusCode = 404;
				let headers = { "Content-Type": "text/plain" };
				let body;

				try {
					const [pathName] = Object.keys(router).filter(function(route) {
						return pathToRegExp(route).test(BASE_PATH + request.url);
					});

					if (request.url.startsWith(BASE_PATH + "/escape-hatch")) {
						request.url = request.url
							.replace(/escape-hatch\\//u, "");

						proxy.web(request, response);

						return;
					} else if (request.method === "GET" && router[pathName] !== undefined) {
						({ statusCode, headers, body } = await router[pathName](request, response));
					}

					response.writeHead(statusCode, headers);
					response.end(body);
				} catch (error) {
					if (statusCode < 500) {
						statusCode = 500;
					}

					console.error(error);

					response.writeHead(statusCode, headers);
					response.end(body ?? "Internal server error");
				}
			});

			server.listen(new URL(BASE_URL).port || 8000, function() {
				console.log("> Ready on " + BASE_URL);
			});
		`,
		"public/js/main.js": await fs.readFile(path.join(__root, "public", "js", "main.js"), { "encoding": "utf8" })
	});
}
