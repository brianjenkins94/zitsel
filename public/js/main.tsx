import Overlay from "@components/overlay";

document.body.prepend(Overlay());

/*
let sandbox;

const version = await(await fetch("https://typescript.azureedge.net/indexes/releases.json")).json()["versions"].pop();

// @ts-expect-error
require.config({
	"paths": {
		"vs": "https://typescript.azureedge.net/cdn/" + version + "/monaco/min/vs",
		"typescript-sandbox": "https://www.typescriptlang.org/js/sandbox"
	},
	"ignoreDuplicateModules": ["vs/editor/editor.main"]
});

const { compilerOptions } = JSON.parse(/^\{.*?^\}/mus.exec(await(await fetch("https://cdn.jsdelivr.net/npm/@tsconfig/node-lts/tsconfig.json")).text())[0]);

// @ts-expect-error
require(["vs/editor/editor.main", "vs/language/typescript/tsWorker", "typescript-sandbox/index"], async function(main, tsWorker, sandbox) {
	sandbox = await sandbox.createTypeScriptSandbox({
		"text": "// Sup",
		"compilerOptions": {
			...compilerOptions
		},
		"domID": "monaco-editor-embed",
		"filetype": "ts"
	}, main, ts);

	sandbox.editor.focus();
	sandbox.editor.layout();
});
*/
