import { WebContainer } from "https://cdn.jsdelivr.net/npm/@webcontainer/api/dist/index.min.js";

window.WEBCONTAINER_API_IFRAME_URL = new URL("/vendor/stackblitz/headless.html", location.origin);

const previewIframe = document.getElementById("preview-iframe");

const webContainer = await WebContainer.boot();

const files = await (await fetch("/api/files")).json();

for (const file of files) {
	files[file] = {
		"contents": files[file]
	};
}

await webContainer.mount(files);

const installProcess = await webContainer.spawn("npm", ["install"]);

const installExitCode = await installProcess.exit;

if (installExitCode !== 0) {
	throw new Error("Unable to run npm install");
}

await webContainer.spawn("node", ["index.js"]);

webContainer.on("server-ready", function(port, url) {
	previewIframe.src = url;
});
