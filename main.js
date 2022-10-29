import http from "http";
import https from "https";
import stream from "stream";
import fs from "fs";
import {} from "./log.js";
import bare from "./bare.js";
import { default as _path } from "path";
import config from "./config.js";
import statusMessages from "./status.js";
import mimeTypes from "./mimetypes.js";

Array.prototype.remove = function(element) {
	for (let i = 0; i < this.length; i++) {
		if (this[i] == element)
			this.splice(i, 1);
	}
};

/**
 * @param {number} code
 * @param {http.ServerResponse} response 
 */
function httpError(code, response) {
	const codeStr = code.toString();
	const errorDoc = `./static/${codeStr}.html`;
	const msg = statusMessages[codeStr];
	const head = { ...config.errorHeaders };

	if (fs.existsSync(errorDoc)) {
		const file = fs.readFileSync(errorDoc, { encoding: "utf-8" });
		head["Content-Type"] = "text/html";
		response.writeHead(code, msg, head);
		response.end(file, "utf-8");
	} else {
		head["Content-Type"] = "text/plain";
		response.writeHead(code, msg, head);
		response.write(codeStr + " " + msg, "utf-8");
		response.end();
	}
}

/**
 * @param {String | undefined} host 
 */
function verifyHost(host) {
	if (host == null) {
		// always reject requests without the host header
		return false;
	}

	const hostname = host.split(":")[0];
	if (!config.allowedHosts.includes(hostname)) {
		// prevent unauthorized hosts
		return false;
	}

	return true;
}

/**
 * @param {String | undefined} url 
 */
function getRequestUrl(url) {
	if (url == null)
		return null;

	return _path.normalize(decodeURIComponent(url));
}

/**
 * @param {String} url 
 */
function getRequestPath(url) {
	const path = _path.join("./static", url);
	if (!fs.existsSync(path))
		return null;

	if (fs.lstatSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory()) {
		for (let f of [
			"index.html",
			"index.htm",
			"index.xml",
			"index.xhtml",
			"index.xht",
			"index.txt",
			"index.png",
			"index.svg"
		]) {
			let p = _path.join(path, f);
			if (fs.existsSync(p))
				return p;
		}

		return null;
	}

	return path;
}

const bareServer = bare("/bare/");

/**
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response
 */
async function requestCallback(request, response) {
	if (!verifyHost(request.headers.host)) {
		httpError(403, response);
		return;
	}

	const url = getRequestUrl(request.url);
	const method = request.method;
	if (url == null || method == null) {
		httpError(400, response);
		return;
	}

	if (method == "OPTIONS") {
		response.writeHead(200, "", config.headers);
		response.end();
		return;
	}

	if (url.startsWith(bareServer.directory)) {
		try {
			const res = await bareServer.routeRequest(url, request);
			if (res == null) {
				httpError(400, response);
				return;
			}

			const headers = {};
			for (let [k, v] of res.headers) {
				headers[k] = v;
			}
			Object.assign(headers, config.headers);
			response.writeHead(res.status, res.statusText, headers);

			const body = res.body;
			if (body instanceof stream.Stream)
				body.pipe(response, { end: true });
			else response.end(res.body, "utf-8");

			return;
		} catch(err) {
			console.log(err);
			httpError(500, response);
			return;
		}
	}


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

/**
 * @param {http.IncomingMessage} request
 * @param {stream.Duplex} socket
 * @param {Buffer} head
 */
async function upgradeCallback(request, socket, head) {
	try {
		const result = await bareServer.routeUpgrade(request.url, request, socket, head);
		if (!result)
			socket.end();
	} catch(err) {
		console.error(err);
		socket.end();
	}
}

const bindAddr = config.address;
const httpPort = config.httpPort;
const httpsPort = config.httpsPort;

if (httpPort != null && httpPort > 0) {
	const httpServer = http.createServer({});
	httpServer.on("request", requestCallback);
	httpServer.on("upgrade", upgradeCallback);
	httpServer.listen(httpPort, bindAddr, () => {
		const addr = httpServer.address();
		console.log(`HTTP server started on ${addr.address}:${addr.port}`);
	});
}

if (httpsPort != null && httpsPort > 0) {
	const httpsServer = https.createServer({
		cert: fs.readFileSync(config.certPath, { encoding: "utf-8" }),
		key: fs.readFileSync(config.privKeyPath, { encoding: "utf-8" })
	});
	httpsServer.on("request", requestCallback);
	httpsServer.on("upgrade", upgradeCallback);
	httpsServer.listen(httpsPort, bindAddr, () => {
		const addr = httpsServer.address();
		console.log(`HTTPS server started on ${addr.address}:${addr.port}`);
	});
}
