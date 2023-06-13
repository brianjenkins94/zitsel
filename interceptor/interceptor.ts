import { chromium } from "playwright-chromium";
import { existsSync, promises as fs } from "fs";
import * as path from "path";
import type { Browser, BrowserContext, Page } from "playwright-chromium";

import { __root } from "../config";

let browser: Browser;

let context: BrowserContext;

async function writeFileIfChanged(filePath, data) {
	if (filePath === undefined || data === undefined) {
		return;
	}

	if (!existsSync(filePath)) {
		console.log("Saving " + filePath);

		return fs.writeFile(filePath, data);
	}

	if (!(data instanceof Buffer)) {
		data = Buffer.from(data, "utf8");
	}

	if (!data.equals(await fs.readFile(filePath))) {
		console.log("Saving " + filePath);

		fs.writeFile(filePath, data);
	}
}


function download({ onIntercept, vendorDirectory }: { onIntercept: (filePath, data) => [string, Buffer | string]; vendorDirectory }) {
	return async function(response) {
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

		if (baseName === path.basename(baseName, path.extname(baseName)) && response.headers()["Content-Type".toLowerCase()]?.includes("text/html")) {
			baseName += ".html";
		}

		const filePath = path.join(vendorDirectory, domain, baseName);

		if (!existsSync(path.dirname(filePath))) {
			return;
		}

		try {
			const data = await response.text();

			writeFileIfChanged(...onIntercept(filePath, data));
		} catch (error) {
			if (!(error instanceof TypeError)) {
				console.error(error);
			}

			try {
				if (/\.(html|js)$/ui.test(pathname)) {
					const data = await (await fetch(response.url())).text();

					writeFileIfChanged(...onIntercept(filePath, data));
				} else {
					const data = await (await fetch(response.url())).arrayBuffer();

					writeFileIfChanged(filePath, new Uint8Array(data));
				}
			} catch (error) {
				console.error("Really failed to get " + response.url());
			}
		}
	};
}

export async function intercept(url, { precondition, onIntercept, vendorDirectory }) {
	function noop() {
		return Promise.resolve();
	}

	precondition ??= noop;
	onIntercept ??= noop;

	browser ??= await chromium.launch({
		"args": [
			"--disable-web-security"
		],
		"devtools": true,
		"headless": false
	});

	context ??= await browser.newContext();

	context.on("serviceworker", download({
		"onIntercept": onIntercept,
		"vendorDirectory": vendorDirectory
	}));

	const page: Page = await context.newPage();

	page.on("response", download({
		"onIntercept": onIntercept,
		"vendorDirectory": vendorDirectory
	}));

	await page.goto(url);

	await precondition(page);

	await page.close();

	return function destroy() {
		return [
			context.close(),
			browser.close()
		].reduce(function(previous, next) {
			// @ts-expect-error
			return previous.then(next);
		}, Promise.resolve());
	};
}
