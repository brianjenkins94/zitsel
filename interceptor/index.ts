import { existsSync, promises as fs } from "fs";
import * as path from "path";
import * as url from "url";
import type { Page } from "playwright-chromium";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../config";
import { intercept } from "./interceptor";

const addresses = {
	"nodebox.html": {
		"precondition": function(page: Page) {
			return page.frameLocator("#preview-iframe").getByText("OK").click();
		},
		"onIntercept": function(filePath, data) {
			return [filePath, data];
		},
		"postcondition": function(vendorDirectory) {
			const files = [
				"__csb_bridge.js",
				"__csb_runtime.js",
				"__csb_sw.js",
				"bridge.html",
				"brotli_wasm_bg.wasm",
				"index.html",
				"preview.html",
				"runtime.js",
				"worker.js"
			];

			const results = files.map(function(fileName) {
				return existsSync(path.join(vendorDirectory, "codesandbox", fileName));
			});

			return results.every(function(exists) {
				return exists;
			});
		}
	},
	"https://webcontainer.new/": {
		"precondition": function(page: Page) {
			return page.frameLocator("iframe[title='Preview page']").frameLocator("#app iframe").getByText("Welcome to a WebContainers app! 🥳").click();
		},
		"onIntercept": function(filePath, data) {
			return [filePath, data];
		},
		"postcondition": function(vendorDirectory) {
			const files = [
				"headless.html"
			];

			const results = files.map(function(fileName) {
				return existsSync(path.join(vendorDirectory, "stackblitz", fileName));
			});

			return results.every(function(exists) {
				return exists;
			});
		}
	},
	"webcontainer.html": {
		"precondition": function(page: Page) {
			return page.frameLocator("#preview-iframe").getByText("OK").click();
		},
		"onIntercept": function(filePath, data) {
			return [filePath, data];
		},
		"postcondition": function(vendorDirectory) {
			const files = [

			];

			const results = files.map(function(fileName) {
				return existsSync(path.join(vendorDirectory, "stackblitz", fileName));
			});

			return results.every(function(exists) {
				return exists;
			});
		}
	}
};

const vendorDirectory = path.join(__root, "public", "vendor");

await fs.mkdir(vendorDirectory, { "recursive": true });

let destroy;

for (let [href, { precondition, onIntercept, postcondition }] of Object.entries(addresses)) {
	try {
		// eslint-disable-next-line no-new
		new URL(href);
	} catch (error) {
		href = url.pathToFileURL(path.join(__dirname, href)).toString();
	}

	destroy = await intercept(href, {
		"onIntercept": onIntercept,
		"precondition": precondition,
		"vendorDirectory": vendorDirectory
	});

	if (!(await postcondition(vendorDirectory))) {
		throw new Error("Post condition not met!");
	}
}

destroy();
