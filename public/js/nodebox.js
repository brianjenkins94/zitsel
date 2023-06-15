import { Nodebox } from "https://cdn.jsdelivr.net/npm/@codesandbox/nodebox/build/index.min.mjs";

const nodeboxIframe = document.getElementById("nodebox-iframe");
const previewIframe = document.getElementById("preview-iframe");

const nodebox = new Nodebox({
	"iframe": nodeboxIframe,
	"runtimeUrl": "/vendor/codesandbox/index.html"
});

await nodebox.connect();

await nodebox.fs.init(await (await fetch("/api/files")).json());

const shell = nodebox.shell.create();

const { id } = await shell.runCommand("node", ["index.js"]);

const { url } = await nodebox.preview.getByShellId(id);

previewIframe.setAttribute("src", "/vendor/codesandbox/preview.html");
