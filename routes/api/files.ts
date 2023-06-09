import { promises as fs } from "fs";

export function get(request, response) {
	const files = {
		"package.json": JSON.stringify({
			"dependencies": {
				"express": "latest"
			}
		}),
		"index.js": `
			import express from "express";

			const BASE_URL = "http://localhost:8000";

			export const server = express();

			server.set("json spaces", 4);

			server.get("/", function(request, response) {
				response.send("OK");
			});

			server.listen(new URL(BASE_URL).port, function() {
				console.log("> Ready on " + BASE_URL);
			});
		`
	};

	response.json(files);
}
