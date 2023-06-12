import { chromium } from "playwright-chromium";
import { existsSync, promises as fs } from "fs";
import * as path from "path";
import * as url from "url";
import type { Browser, BrowserContext, Page } from "playwright-chromium";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../config";

const vendorDirectory = path.join(__root, "public", "vendor");

await fs.mkdir(vendorDirectory, { "recursive": true });

let browser: Browser;

let context: BrowserContext;

async function writeFileIfChanged(fileName, data) {
	if (!existsSync(fileName)) {
		console.log("Saving " + fileName);

		return fs.writeFile(fileName, data);
	}

	if (!(data instanceof Buffer)) {
		data = Buffer.from(data, "utf8");
	}

	if (!data.equals(await fs.readFile(fileName))) {
		console.log("Saving " + fileName);

		fs.writeFile(fileName, data);
	}
}

function amendFile(fileName, data): [string, Buffer | string] {
	return [fileName, data];
}

async function download(response) {
	const { hostname, pathname } = new URL(response.url());

	if (hostname === "") {
		return;
	}

	// WARN: This is not perfect.
	const [subdomain, domain, tld] = Array.from({ ...hostname.split(".").reverse(), "length": 3 }).reverse();

	let baseName = path.basename(pathname);
	//const pathName = path.join(pathname.slice(0, -baseName.length));
	baseName = baseName.replace(/[-.]\w+\./gu, ".");
	baseName ||= hostname.includes("nodebox-runtime.codesandbox.io") ? "bridge.html" : "preview.html";

	if (baseName === path.basename(baseName, path.extname(baseName)) && response.headers()["Content-Type".toLowerCase()].includes("text/html")) {
		baseName += ".html";
	}

	const fileName = path.join(vendorDirectory, domain, baseName);

	if (!existsSync(path.dirname(fileName))) {
		return;
	}

	try {
		const data = await response.text();

		writeFileIfChanged(...amendFile(fileName, data));
	} catch (error) {
		if (!(error instanceof TypeError)) {
			console.error(error);
		}

		try {
			if (/\.(html|js)$/ui.test(pathname)) {
				const data = await (await fetch(response.url())).text();

				writeFileIfChanged(...amendFile(fileName, data));
			} else {
				const data = await (await fetch(response.url())).arrayBuffer();

				writeFileIfChanged(fileName, new Uint8Array(data));
			}
		} catch (error) {
			console.error("Really failed to get " + response.url());
		}
	}
}

export async function intercept(url, precondition = function(page) { return Promise.resolve(); }) {
	browser ??= await chromium.launch({
		"args": [
			"--disable-web-security"
		],
		"devtools": true,
		"headless": false
	});

	context ??= await browser.newContext();

	context.on("serviceworker", download);

	const page: Page = await context.newPage();

	page.on("response", download);

	await page.goto(url);

	await precondition(page);

	await page.close();
}

const addresses = {
	//"nodebox.html": {}
	//"https://webcontainer.new/": {
	//	"precondition": function(page: Page) {
	//		return page.frameLocator("iframe[title='Preview page']").frameLocator("#app iframe").getByText("Welcome to a WebContainers app! 🥳").click();
	//	}
	//},
	"webcontainer.html": {
		"precondition": function(page: Page) {
			return page.frameLocator("#preview-iframe").getByText("OK").click();
		},
		"condition": function() {

		},
		"postcondition": function() {

		}
	}
};

for (let [href, { precondition, condition, postcondition }] of Object.entries(addresses)) {
	try {
		// eslint-disable-next-line no-new
		new URL(href);
	} catch (_) {
		href = url.pathToFileURL(path.join(__dirname, href)).toString();
	}

	//try {
	await intercept(href, precondition);
	//} catch (error) {
	//  // This can happen when the browser is closed and the a response handler is in the process of handling a response.
	//  if (error.message !== "browserContext.newPage: Target page, context or browser has been closed") {
	//      throw error;
	//  }
	//}
}

await context.close();

await browser.close();
