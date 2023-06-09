import { Nodebox } from "https://cdn.jsdelivr.net/npm/@codesandbox/nodebox/build/index.min.mjs";

const nodeboxIframe = document.getElementById("nodebox-iframe");
const previewIframe = document.getElementById("preview-iframe");

const BASE_URL = location.pathname.endsWith("/") ? location.pathname.slice(0, -1) : location.pathname;

const nodebox = new Nodebox({
	"iframe": nodeboxIframe,
	"runtimeUrl": BASE_URL + "/vendor/codesandbox/bridge.html"
});

await nodebox.connect();

await nodebox.fs.init(await (await fetch(BASE_URL + "/api/files")).json());

const shell = nodebox.shell.create();

const { id } = await shell.runCommand("node", ["index.js"]);

const { url } = await nodebox.preview.getByShellId(id);

previewIframe.setAttribute("src", BASE_URL + "/vendor/codesandbox/preview.html");
