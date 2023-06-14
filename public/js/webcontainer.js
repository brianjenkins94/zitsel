import { WebContainer } from "https://cdn.jsdelivr.net/npm/@webcontainer/api/dist/index.min.js";

window.WEBCONTAINER_API_IFRAME_URL = new URL("/vendor/stackblitz/headless.html", location.origin);

const previewIframe = document.getElementById("preview-iframe");

const webContainer = await WebContainer.boot();

function getOrCreateKeyOfObjectByPath(object, path) {
	return path.reduce(function(object, key) {
		if (object[key] === undefined) {
			object[key] = {};
		}

		return object[key];
	}, object) || object;
}

const files = {};

for (const [filePath, contents] of Object.entries(await (await fetch("/api/files")).json())) {
	getOrCreateKeyOfObjectByPath(files, filePath.split("/").reduce(function(previous, current) {
		return [...previous, "directory", current];
	}, []))["file"] = {
		"contents": contents
	};
}

await webContainer.mount(files["directory"]);

const installProcess = await webContainer.spawn("npm", ["install"]);

const installExitCode = await installProcess.exit;

if (installExitCode !== 0) {
	throw new Error("Unable to run npm install");
}

await webContainer.spawn("node", ["index.js"]);

webContainer.on("server-ready", function(port, url) {
	previewIframe.src = url;
});
