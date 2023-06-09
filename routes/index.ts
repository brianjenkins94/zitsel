import { __root } from "../config";

export function get(request, response) {
	response.sendFile("public/index.html", { "root": __root });
}

// Example route with a URL parameter and middleware:
//import { json } from "express";
//
//export function post(path) {
//  return {
//      "path": path + "/:parameter",
//      "middleware": [
//          require("express").json()
//      ],
//      "callback": function(request, response) {
//          response.json({
//              "parameter": request.params["parameter"],
//              ...request.body
//          });
//      }
//  };
//}
