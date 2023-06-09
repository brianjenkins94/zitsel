import { defineConfig } from "tsup";
import { promises as fs } from "fs";
import { renderToString as render } from "react-dom/server";
import * as path from "path";
import * as React from "react";
import * as url from "url";
import type { Options } from "tsup";
import { Range } from "./src/Range";

function kebabCaseToPascalCase(string) {
	return string.replace(/(^\w|-\w)/gu, function(string) {
		return string.replace(/-/u, "").toUpperCase();
	});
}

function pascalCaseToKebabCase(string) {
	return string.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase();
}

function esbuildOptions(options, context) {
	//options.jsxImportSource = "preact";
}

async function tsup(options: Options) {
	options.entry = [options.entry[0].replace(/\\/gu, "/")];

	return (await import("tsup")).build({
		"esbuildOptions": esbuildOptions,
		"esbuildPlugins": [],
		// WORKAROUND: `tsup` gives the entry straight to `globby` and `globby` doesn't get along with Windows paths.
		"format": "esm",
		"treeshake": true,
		...options
	});
}

const components = {};
const scripts = {};

function precompileComponent(build) {
	build.onLoad({ "filter": /components/u }, async function({ "path": filePath }) {
		const fileName = /(?<=components\/.*?\/).*?(?=\/|\.)/u.exec(filePath.replace(/\\/gu, "/")).pop();
		const packageName = (/(?<=components\/).*?(?=\/|\.)/u.exec(filePath.replace(/\\/gu, "/")) || []).pop();
		const properName = kebabCaseToPascalCase(packageName ?? fileName);

		await tsup({
			"entry": [filePath]
		});

		const compiledOutputPath = path.join(__dirname, "dist", fileName + ".js");

		const defaultExport = (await import(url.pathToFileURL(compiledOutputPath).toString() + "?ts=" + Date.now())).default;

		if (fileName.startsWith("index") && defaultExport?.postload !== undefined) {
			// <monkey-patch>
			const sourceFile = await fs.readFile(filePath, { "encoding": "utf8" });

			const code = sourceFile
				// Comment out non-relative imports
				.replace(/^(import .*? from (?:'|")[^\\.]+(?:'|");)$/gmu, "//$1")
				// Remove default export
				.replace(new RegExp("^export default function " + properName + ".*?^\\};$", "msu"), "")
				// Remove preload
				.replace(new RegExp("^" + properName + "\\.preload = .*?^\\};$", "msu"), "")
				// Replace postload
				.replace(new RegExp("^" + properName + "\\.postload = .*?^\\};$", "msu"), defaultExport.postload.toString().split("\n").slice(1, -1).join("\n"));

			const inputFilePath = path.join(__dirname, "dist", path.basename(filePath));

			await fs.writeFile(inputFilePath, code);
			// </monkey-patch>

			await tsup({
				"esbuildPlugins": [
					{
						"name": "import-relative",
						"setup": function(build) {
							build.onResolve({ "filter": /\.\/.*/u }, function({ "path": importPath }) {
								return {
									"path": path.join(path.dirname(filePath), importPath + ".ts")
								};
							});
						}
					}
				],
				"entry": [inputFilePath],
				"treeshake": {
					"manualPureFunctions": ["cssRaw", "cssRule", "style"]
				}
			});

			const compiledOutput = await fs.readFile(compiledOutputPath, { "encoding": "utf8" });

			components[properName] = "function() {\n" + compiledOutput + "\n}";

			scripts[properName] = defaultExport?.preload?.();
		}
	});
}

const stack = [];

function amendMarkup(component) {
	const name = component.props.children.type.name ?? component.props.children.type;
	const kebabCaseName = pascalCaseToKebabCase(name);

	if (typeof component.props.children.type === "function") {
		component = component.props.children.type();
	}

	let { children } = component.props;

	const uuid = crypto.randomUUID().slice(0, 8);

	stack.push({
		"type": kebabCaseName,
		"id": uuid
	});

	if (Array.isArray(children)) {
		const first = React.cloneElement(children[0], {
			["data-" + kebabCaseName + "-start"]: uuid
		});

		const last = React.cloneElement(children[children.length - 1], {
			["data-" + kebabCaseName + "-end"]: uuid
		});

		children = [first, ...children.slice(1, -1), last];
	} else {
		children = React.cloneElement(children, {
			["data-" + kebabCaseName + "-start"]: uuid,
			["data-" + kebabCaseName + "-end"]: uuid
		});
	}

	children = (function recurse(children) {
		return React.Children.map(children, function(child) {
			return React.cloneElement(child, {
				"name": child.props?.name !== undefined ? [kebabCaseName, uuid, child.props.name].join("-") : undefined,
				"children": typeof child.props?.children === "object" ? recurse(child.props.children) : child.props?.children
			});
		});
	})(children);

	return React.createElement(React.Fragment, {
		...component.props,
		"children": children
	});
}

export default defineConfig({
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		{
			"name": "precompile",
			"setup": function(build) {
				build.onLoad({ "filter": /components|packages/u }, async function({ "path": filePath }) {
					const fileName = /(?<=(?:components|packages)\/.*?\/).*?(?=\/|\.)/u.exec(filePath.replace(/\\/gu, "/")).pop();
					const packageName = (/(?<=components\/).*?(?=\/|\.)/u.exec(filePath.replace(/\\/gu, "/")) || []).pop();
					const properName = kebabCaseToPascalCase(packageName ?? fileName);

					await tsup({
						"esbuildPlugins": [
							{
								"name": "precompile-component",
								"setup": precompileComponent
							}
						],
						"entry": [filePath]
					});

					const compiledOutputPath = path.join(__dirname, "dist", fileName + ".js");

					// <monkey-patch>
					await fs.writeFile(compiledOutputPath, (await fs.readFile(compiledOutputPath, { "encoding": "utf8" }))
						// Remove `phaser` import
						.replace(/^(import .*? from (?:'|")phaser.*?(?:'|");)$/gmu, "//$1"));

					const defaultExport = (await import(url.pathToFileURL(compiledOutputPath).toString() + "?ts=" + Date.now())).default;

					const sourceFile = (await fs.readFile(filePath, { "encoding": "utf8" }))
						// Remove `phaser` import
						.replace(/^(import .*? from (?:'|")phaser.*?(?:'|");)$/gmu, "//$1");
					// </monkey-patch>

					const component = defaultExport();

					let code = sourceFile
						// Replace return
						.replace(new RegExp("(?<=^export default function " + properName + ".*?\\n).*?(?=\\n\\})", "msu"), `return \`${render(component)}\`;`)
						// Remove pre/post-load
						.replace(new RegExp("^" + properName + "\\.(?:pre|post)load = .*?^\\};$", "gmsu"), "");

					if (filePath.includes("packages")) {
						components[properName] = defaultExport?.postload.toString();

						code = `
							const startTime = performance.now();
							${code}
							document.body.appendChild(document.createRange().createContextualFragment(${properName}()));

							const Range = ${Range.toString()};

							const components = ${JSON.stringify(Object.entries(components).reduce(function(object, [key, value]) { return { ...object, [key]: "function(range) {\nreturn (function(range) { return function() {\n" + value.toString().split("\n").slice(1, -1).join("\n") + "\n};\n})(range);\n}" }; }, {}), function(key, value) { return typeof value === "function" ? value.toString() : value; }, 2)
								// TODO: Find a better way to do this:
								.replace(/\\n/gu, "\n") // Unescape newlines
								.replace(/\\t/gu, "\t") // Unescape tabs
								.replace(/\\"/gu, "\"") // Unescape quotes
								.replace(/ anonymous\d*/gu, "") // Anonymize
								.replace(/(?:'|")(function.*?\})(?:'|")(?=,\n {2}|\n\})/gsu, "$1") // Unquote function
							};

							const stack = ${JSON.stringify(stack)};

							function loadAsset({ src, href }) {
								const id = /(?<=\\/)[\\w-]+(?=\\.[\\w.]+$)/u.exec(src ?? href);

								let timer;

								return Promise.race([
									new Promise<void>(function(resolve, reject) {
										if (document.getElementById(id)) {
											resolve();
										} else if (src !== undefined) {
											const script = document.createElement("script");
											script.id = id + "-script";
											script.src = src;
											script.onload = function() {
												resolve();
											};

											document.head.appendChild(script);
										} else if (href !== undefined) {
											const style = document.createElement("link");
											style.id = id + "-stylesheet";
											style.href = href;
											style.rel = "stylesheet";
											style.onload = function() {
												resolve();
											};

											document.head.appendChild(style);
										}
									}),
									new Promise<void>(function(resolve, reject) {
										timer = setTimeout(function() {
											reject("Attempt to load " + (src ?? href) + " failed.");
										}, 200000);
									})
								]).then(function() {
									clearTimeout(timer);
								});
							}

							Promise.all(Object.entries(${JSON.stringify(scripts, undefined, 2)}).map(function([component, scripts]) {
								return Promise.all(scripts.map(loadAsset))
									.then(components[component](new Range(stack.pop())));
							}))
								.then(function() {
									return Promise.all(${JSON.stringify(defaultExport?.preload?.())}.map(loadAsset));
								})
								.then(components["${properName}"]())
								.then(function() {
									console.log("Ready in " + (performance.now() - startTime).toFixed(3) + " ms");
								});
						`.trim();
					}

					return {
						"contents": code,
						"loader": "ts"
					};
				});
			}
		}
	],
	"external": ["phaser"],
	"treeshake": true
});
