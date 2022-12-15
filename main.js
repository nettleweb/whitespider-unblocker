import http from "http";
import https from "https";
import fs from "fs";
import { default as _path } from "path";
import config from "./config.js";
import statusMessages from "./status.js";
import mimeTypes from "./mime.js";
import { out, lock } from "./streamsetup.js";

out.clear();
out.color("1;36;25")("WhiteSpider Unblocker v1.3.0");
out.color("1;35;25")(" Created by Ruochen Jia\n");
await lock(800);
out.color(1)("Source Code: https://github.com/ruochenjia/whitespider-unblocker\n");
out.color(1)("Official Mirror: https://unblocker.whitespider.gq\n");
out.color(1)("More projects created by me: https://github.com/ruochenjia\n");
await lock(800);
out.color("1;33")("\nStarting server...\n\n");
await lock(1000);

// Import tomcat after print information as it is likely to crash.
const bind = (await import("./tomcat.js")).bind;

/**
 * @param {number} code
 * @param {http.ServerResponse} response 
 */
function httpError(code, response) {
	const errorDoc = `./static/${code}.html`;
	const errorDoc2 = `./static/${code}.xht`;
	const msg = statusMessages[code];
	const head = { ...config.errorHeaders };

	if (fs.existsSync(errorDoc)) {
		const file = fs.readFileSync(errorDoc, { encoding: "utf-8" });
		head["Content-Type"] = "text/html";
		response.writeHead(code, msg, head);
		response.end(file, "utf-8");
	} else if (fs.existsSync(errorDoc2)) {
		const file = fs.readFileSync(errorDoc2, { encoding: "utf-8" });
		head["Content-Type"] = "application/xhtml+xml";
		response.writeHead(code, msg, head);
		response.end(file, "utf-8");
	} else {
		head["Content-Type"] = "text/plain";
		response.writeHead(code, msg, head);
		response.write(msg, "utf-8");
		response.end();
	}
}

/**
 * @param {string} host
 */
function verifyHost(host) {
	return config.allowedHosts.includes(host.split(":")[0]);
}

/**
 * @param {URL} url
 */
function getRequestPath(url) {
	const path = _path.join("./static", url.pathname);
	if (!fs.existsSync(path))
		return null;

	if (fs.lstatSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory()) {
		for (let f of [
			"index.html",
			"index.htm",
			"index.xhtml",
			"index.xht",
			"index.xml"
		]) {
			const p = _path.join(path, f);
			if (fs.existsSync(p))
				return p;
		}

		return null;
	}

	return path;
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
function requestCallback(request, response) {
	const host = request.headers.host;
	if (host == null || !verifyHost(host)) {
		httpError(403, response);
		return;
	}

	const rawPath = request.url;
	const method = request.method;
	if (rawPath == null || method == null) {
		httpError(400, response);
		return;
	}

	if (config.allowPing && method === "PING") {
		response.writeHead(200, "PING_SUCCESS", {});
		response.end("RlVDSyBZT1UgR09PR0xF/b+AkICB", "utf-8");
	}

	const url = new URL(`https://${host}${rawPath}`);
	const path = getRequestPath(url);
	if (path == null) {
		httpError(404, response);
		return;
	}

	const file = fs.readFileSync(path);
	const head = { ...config.headers };
	const extName = _path.extname(path);
	head["Content-Type"] =  extName in mimeTypes ? mimeTypes[extName] : "application/unknown";

	response.writeHead(200, "", head);
	response.end(file, "utf-8");
}

const bindAddr = config.address;
const httpPort = config.httpPort;
const httpsPort = config.httpsPort;

if (httpPort != null && httpPort > 0 && httpPort < 0xffff) {
	const httpServer = http.createServer({});
	httpServer.on("request", requestCallback);
	httpServer.listen(httpPort, bindAddr, () => {
		const addr = httpServer.address();
		out.color("32;1")(`HTTP server started on ${addr.address}:${addr.port}\n`);
	});
	bind(httpServer);
}

if (httpsPort != null && httpsPort > 0 && httpsPort < 0xffff) {
	const httpsServer = https.createServer({
		cert: fs.readFileSync(config.certPath, { encoding: "utf-8" }),
		key: fs.readFileSync(config.privKeyPath, { encoding: "utf-8" })
	});
	httpsServer.on("request", requestCallback);
	httpsServer.listen(httpsPort, bindAddr, () => {
		const addr = httpsServer.address();
		out.color("32;1")(`HTTPS server started on ${addr.address}:${addr.port}`);
	});
	bind(httpsServer);
}
