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
						"doc": "    ^--------------------------------------------^",
						"from": /\/?__csb_sw(\.\w+)\.js/gu,
						"to": "__csb_sw.js"
					},
					// Leaving this here in case we decide we need to move the service worker again.
					/*
					{
						"example": "(_0x100c1b(0x193),{'scope':'/'}",
						"doc": "    ^-----------^",
						"from": /\(_0x\w{6}\(0x\w{3}\),\{'scope':'\/'\}/u,
						"to": "('../../__csb_sw.js',{'scope':'../../'}"
					},
					*/
					{
						"example": "{'scope':'/'}",
						"doc": "    ^-----------^",
						"from": /\{'scope':'\/'\}/u,
						"to": "{'scope':'.'}"
					},
					{
						"example": "var _0x2dca1e=new URL(_0x4cb68c(0x23d),location[_0x4cb68c(0x248)])[_0x4cb68c(0x209)];",
						"doc": "                  ^--------------------------------------------------------------------^",
						"from": /new URL\(_0x\w{6}\(0x\w{3}\),location\[_0x\w{6}\(0x\w{3}\)\]\)\[_0x\w{6}\(0x\w{3}\)\]/u,
						"to": "location.href.replace(/index\\.html$/u,'__csb_sw.js')"
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
						"example": "'/__csb'",
						"doc": "    ^------^",
						"from": /'\/__csb'/u,
						"to": "'vendor/codesandbox/'"
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
							return "/\\/vendor\\/codesandbox\\/(?!escape-hatch\\/)/u.test(" + url + ")";
						}
					}
					/*
					{
						"example": "let _0x5a79f9=_0x3c9189(_0x5c948f,location);if(_0x5a79f9==null||isNaN(_0x5a79f9))",
						"doc": "                            ^-------^             ><",
						"from": /(?<=let _0x\w{6}=_0x\w{6}\((_0x\w{6}),location\);if\()(?=_0x\w{6}==null\|\|isNaN\(_0x\w{6}\)\))/u,
						"to": function(_, url) {
							return url + ".pathname.startsWith('/TypeCraft/proxy/escape-hatch')||";
						}
					}
					*/
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
				"worker.js": [],
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

			// Leaving this here in case we decide we need to move the service worker again.
			/*
			// Service Worker scope is dictated by its path.
			if (fileName === "__csb_sw.js") {
				filePath = path.join(path.dirname(filePath), "..", "..", fileName);
			}
			*/

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
	/*
	"https://stackblitz.com/edit/stackblitz-webcontainer-api-starter-1dztjd": {
		"precondition": function(page: Page) {
			return page.frameLocator("iframe[title='Preview page']").frameLocator("#app iframe").getByText("Welcome to a WebContainers app! 🥳").click();
		},
		"onIntercept": function(filePath, data) {
			let fileName = path.basename(filePath);

			if (!filePath.endsWith(path.join("blitz", fileName))) {
				return [];
			}

			filePath = path.join(path.dirname(filePath).replace(/staticblitz/u, "stackblitz"), fileName);

			if (!fileName.includes("a12d8c69")) {
				// WARN: This is not perfect.
				fileName = fileName.replace(/[-.]\w+(?=\.\w+$)/u, "");
				filePath = path.join(path.dirname(filePath), fileName);
			}

			if (fileName === "headless.html") {
				data = prune(data, {
					"prepend": [
						"<link href=\"https://cdn.jsdelivr.net/npm/modern-normalize/modern-normalize.min.css\" rel=\"stylesheet\" />",
						"<base href=\"/vendor/stackblitz/\" />"
					].join("")
				});
			}

			const allowlist = {
				"fetch.worker.a12d8c69.js": [],
				"headless.html": [
					{
						"example": "webcontainer.js",
						"doc": "    ^-------------^",
						"from": /webcontainer\.js/u,
						"to": "webcontainer.a12d8c69.js"
					}
				],
				"headless.js": [
					{
						"example": "n.embedder",
						"doc": "    ^--------^",
						"from": /n\.embedder/gu,
						"to": "location.origin"
					},
					{
						"example": "n.baseUrl",
						"doc": "    ^-------^",
						"from": /n\.baseUrl/u,
						"to": "'https://w-corp.staticblitz.com'"
					},
					{
						"example": "n.serverUrl",
						"doc": "    ^---------^",
						"from": /n\.serverUrl/u,
						"to": "'https://local-corp.webcontainer.io'"
					},
					{
						"example": "n.serverVersion",
						"doc": "    ^-------------^",
						"from": /n\.serverVersion/u,
						"to": "'a12d8c69'"
					},
					{
						"example": "n.version",
						"doc": "    ^-------^",
						"from": /n\.version/u,
						"to": "'a12d8c69'"
					},
					{
						"example": "n.isolationPolicy",
						"doc": "    ^---------------^",
						"from": /n.isolationPolicy/u,
						"to": "'require-corp'"
					},
				],
				"webcontainer.a12d8c69.js": [
					{
						"example": "_0x3f0493=[new URL('/bin_index.a12d8c69',_0x122f9f)['href'],...null!=_0x467f25?_0x467f25:[]];",
						"doc": "               ^------------------------------------------------------------------------------^",
						"from": /(?<=_0x\w{6}=\[)new URL\(.*?(?=\];)/u,
						"to": "location.origin + '/w-corp.staticblitz/bin_index.a12d8c69'"
					},
					{
						"example": "'https://t.staticblitz.com",
						"doc": "    ^------------------------^",
						"from": /'https:\/\/t\.staticblitz\.com/u,
						"to": "location.origin + '/t.staticblitz"
					},
					{
						"example": "'/fetch.worker.a12d8c69.js'",
						"doc": "    ^------------------------^",
						"from": /'\/fetch\.worker\.a12d8c69\.js/u,
						"to": "'/w-corp.staticblitz/fetch.worker.a12d8c69.js"
					}
				],
				"bin_index.a12d8c69": []
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
				"bin_index.a12d8c69",
				"fetch.worker.a12d8c69.js",
				"headless.html",
				"webcontainer.a12d8c69.js"
			];

			const results = files.map(function(fileName) {
				return existsSync(path.join(vendorDirectory, "stackblitz", fileName));
			});

			return results.every(function(exists) {
				return exists;
			});
		}
	},
	*/
	"http://localhost:8000/": {
		"precondition": function(page: Page) {
			// WARN: This is testing more than the minimum.
			return page.frameLocator("#preview-iframe").locator("body > *").first().click({ "timeout": 300_000 });
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
