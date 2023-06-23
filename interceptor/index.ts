import { existsSync, promises as fs } from "fs";
import * as path from "path";
import * as url from "url";
import * as cheerio from "cheerio";
import type { Page } from "playwright-chromium";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../config";
import { intercept } from "./interceptor";

function replace(input: string, { example, doc, from, to }: { example; doc; from: RegExp; to }) {
	if (!from.test(example)) {
		throw new Error("`" + from.toString() + "` did not match example!");
	}

	if (doc === undefined) {
		throw new Error("No `doc` provided for `" + from.toString() + "`!");
	}

	const [stretch] = /\^-+\^/ui.exec(doc) || [];

	if (stretch !== undefined) {
		example = example.replace(from, stretch);

		if (!example.includes(stretch)) {
			throw new Error("`doc` did not match `example` for " + from.toString() + "!");
		}
	} else {
		console.warn("Could not test `doc` against `example` for " + from.toString() + ".");
	}

	const globalPattern = new RegExp(from.source, [...new Set(["g", ...from.flags])].join(""));

	const matches = (input.match(globalPattern) || []).length;

	if (matches === 0) {
		throw new Error(from.toString() + " did not match!");
	}

	const output = input.replace(from, to);

	if (matches === (output.match(globalPattern) || []).length) {
		throw new Error("Match count did not change for " + from.toString() + "!");
	}

	return output;
}

function prune(data, options = {}) {
	const $ = cheerio.load(data);

	(function recurse(elements) {
		for (const element of elements.children()) {
			const src = $(element).attr("src");

			if (element.tagName === "script" && src !== undefined) {
				if (src.startsWith("https://cdn.jsdelivr.net/")) {
					continue;
				} else if (!/cdn-cgi|cloudflare/u.test(src)) {
					$(element).attr("src", path.basename(src).split("?")[0].replace(/[-.]\w+\./gu, "."));
					$(element).attr("type", "module");

					continue;
				}
			} else if (!["meta", "script", "style", undefined].includes(element.tagName)) {
				recurse($(element));

				continue;
			}

			$(element).remove();
		}
	})($("html"));

	if (options["prepend"] !== undefined) {
		$("head").prepend(options["prepend"]);
	}

	return $.html();
}

let indexCount = 0;

const addresses = {
	"codesandbox/nodebox.html": {
		"precondition": function(page: Page) {
			return page.frameLocator("#preview-iframe").getByText("OK").click();
		},
		"onIntercept": function(filePath, data) {
			let fileName = path.basename(filePath);

			// WARN: This is not perfect.
			fileName = fileName.replace(/[-.]\w+(?=\.\w+$)/u, "");

			// TODO: Find a better way to do this:
			if (fileName === "index.html") {
				if (indexCount === 0) {
					fileName = "bridge.html";
				} else if (indexCount === 2) {
					fileName = "preview.html";
				}

				indexCount += 1;
			}

			filePath = path.join(path.dirname(filePath), fileName);

			if (fileName.endsWith(".html")) {
				data = prune(data, {
					"prepend": [
						"<link href=\"https://cdn.jsdelivr.net/npm/modern-normalize/modern-normalize.min.css\" rel=\"stylesheet\" />"
						//"<base href=\"/vendor/codesandbox/\" />"
					].join("")
				});
			}

			const allowlist = {
				"runtime.js": [
					{
						"example": "worker-praeod644nej8ndeqhk4g54xnwdwekw.js",
						"doc": "    ^-------------------------------------^",
						"from": /worker-\w+\./u,
						"to": "worker."
					},
					{
						"example": "_0x248c43=this[_0x83edf3(0x3e2)](_0x537ed8,_0x70bb64+_0x83edf3(0x559),'bridge');",
						"doc": "                                               ^------------------------^",
						"from": /(?<=\(_0x\w{6},\s*)_0x\w{6}\s*\+\s*_0x\w{6}\(0x\w{3}\)(?=,\s*'bridge'\))/u,
						"to": "'index.html'"
					},
					{
						"example": "'sourceShellId':_0x362a85(this[_0x11a7cb(0x658)][_0x11a7cb(0x60b)](_0x34f176[_0x11a7cb(0x3c2)]),",
						"doc": "                              ^-------------------------------------------------------------------^",
						"from": /(?<=_0x\w{6}\()(this\[_0x\w{6}\(0x\w{3}\)\])\[_0x\w{6}\(0x\w{3}\)\]\(_0x\w{6}\[_0x\w{6}\(0x\w{3}\)\]\)/u,
						"to": function(_, map) {
							return map + ".values().next().value";
						}
					}
				],
				"__csb_bridge.js": [
					{
						"example": "let _0x576891=+_0x361bca[_0x2e1afb(0x1a7)]('.')[0x0][_0x2e1afb(0x1a7)]('-')[0x1];",
						"doc": "                  ^----------------------------------------------------------------^",
						"from": /\+_0x\w{6}\[_0x\w{6}\(0x\w{3}\)\]\('\.'\)\[0x0\]\[_0x\w{6}\(0x\w{3}\)\]\('-'\)\[0x1\]/u,
						"to": "8000"
					},
					{
						"example": "/__csb_sw.n8h9n5kw9fbcw1sti2w7dwmh20n21mt.js",
						"doc": "    ^------------------------------------------^",
						"from": /\/?__csb_sw(\.\w+)\.js/gu,
						"to": "__csb_sw.js"
					},
					{
						"example": "{'scope':'/'}",
						"doc": "    ^-----------^",
						"from": /\{'scope':'\/'\}/u,
						"to": "{'scope':'.'}"
					}
				],
				"__csb_sw.js": [
					{
						"example": "let _0x121447=+_0xfb585f['split']('.')[0x0][_0x68d8a2(0x122)]('-')[0x1];",
						"doc": "                  ^-------------------------------------------------------^",
						"from": /\+_0x\w{6}\['split'\]\('\.'\)\[0x0\]\[_0x68d8a2\(0x122\)\]\('-'\)\[0x1\]/u,
						"to": "8000"
					},
					{
						"example": "/__csb_runtime.8khva2zw4nsr5iciw79jxa2txw3l9vp.js",
						"doc": "    ^-----------------------------------------------^",
						"from": /\/__csb_runtime(\.\w+)?\.js/u,
						"to": "__csb_runtime.js"
					},
					// These last two add an escape hatch for proxying requests outside of the nodebox.
					{
						"example": "if(_0x5c948f[_0x10fc7d(0x103)][_0x10fc7d(0xd1)](_0x10fc7d(0xd5)))",
						"doc": "       ^-----------------------------------------------------------^",
						"from": /(?<=if\()(_0x\w{6})\[_0x\w{6}\(0x\w{3}\)\]\[_0x\w{6}\(0x\w{2}\)\]\(_0x\w{6}\(0x\w{2}\)\)(?=\))/u,
						"to": function(_, url) {
							return url + ".pathname.startsWith('/zitsel/vendor/codesandbox/')&&!/escape-hatch\\//u.test(" + url + ")";
						}
					},
					{
						"example": "let _0x5a79f9=_0x3c9189(_0x5c948f,location);if(_0x5a79f9==null||isNaN(_0x5a79f9))",
						"doc": "                            ^-------^             ><",
						"from": /(?<=let _0x\w{6}=_0x\w{6}\((_0x\w{6}),location\);if\()(?=_0x\w{6}==null\|\|isNaN\(_0x\w{6}\)\))/u,
						"to": function(_, url) {
							return "/escape-hatch\\//u.test(" + url + ")||";
						}
					}
				],
				"__csb_runtime.js": [
					{
						"example": "return _0x341822===_0x3d7a43?_0x2cb0c0(_0x40106d[_0x3e6327(0xc1)]):null;",
						"doc": "           ^--------------------------------------------------------------^",
						"from": /(?<=return )_0x\w{6}===_0x\w{6}\?_0x\w{6}\(_0x\w{6}\[_0x\w{6}\(0x\w{2}\)\]\):null(?=;)/u,
						"to": "8000"
					}
				],
				"brotli_wasm_bg.wasm": [],
				"worker.js": [
					// https://github.com/codesandbox/nodebox-runtime/issues/40
					{
						"example": "'//'+_0x441ac2[_0xde1365(0x1059)]+(_0x441ac2[_0xde1365(0x887)]?':'",
						"doc": "                  ^------------------^",
						"from": /(?<='\/\/'\+_0x\w{6})\[_0x\w{6}\(0x\w{4}\)\]\+/u,
						"to": ".hostname+"
					}
				],
				"bridge.html": [],
				"index.html": [],
				"preview.html": [
					{
						"example": "<script src=\"main.js\"",
						"doc": "                 ^------^",
						"from": /"main\.js/u,
						"to": "\"/js/main.js"
					}
				]
			};

			if (allowlist[fileName] === undefined) {
				return [];
			}

			for (const substitution of allowlist[fileName]) {
				data = replace(data, substitution);
			}

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
	"http://localhost:8000/": {
		"precondition": function(page: Page) {
			// WARN: This is testing more than the minimum.
			return page.frameLocator("#preview-iframe").locator("body > *").last().click({ "timeout": 300_000 });
		},
		"onIntercept": function(filePath, data) {
			const fileName = path.basename(filePath);

			if (fileName === "files") {
				filePath = path.join(path.dirname(filePath), "..", "api", "files", "index.json");
			}

			const allowlist = {
				"files": []
			};

			if (allowlist[fileName] === undefined) {
				return [];
			}

			for (const substitution of allowlist[fileName]) {
				data = replace(data, substitution);
			}

			return [filePath, data];
		},
		"postcondition": function(vendorDirectory) {
			const files = [
				"../api/files/index.json"
			];

			const results = files.map(function(fileName) {
				return existsSync(path.join(vendorDirectory, fileName));
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

for (const signal of ["SIGINT", "SIGUSR1", "SIGUSR2"]) {
	process.on(signal, function() {
		destroy?.();
	});
}

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
		"postcondition": postcondition,
		"vendorDirectory": vendorDirectory
	});

	console.log("\n---\n");
}

destroy();
