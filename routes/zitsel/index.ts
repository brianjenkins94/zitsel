import * as path from "path";

import { __root } from "../../config";

export function get(request, response) {
	response.sendFile(path.join(__root, "public", "index.html"));
}
