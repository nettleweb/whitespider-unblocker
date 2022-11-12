var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Agent as HttpAgent, request as httpRequest } from "http";
import { Agent as HttpsAgent, request as httpsRequest } from "https";
import { Headers } from "headers-polyfill";
import { randomBytes } from "crypto";
import { promisify } from "util";
import { default as dns } from "dns";
class Request {
    constructor(base) {
        this.body = base;
        this.method = base.method;
        this.headers = new Headers(base.headers);
        this.url = new URL(`https://${this.headers.get("host")}${base.url}`);
        this.query = this.url.searchParams;
    }
}
class Response {
    constructor(body, init) {
        this.body = body;
        if (init != null) {
            this.status = init.status == null ? 200 : init.status;
            this.statusText = init.statusText == null ? "" : init.statusText;
            this.headers = new Headers(init.headers);
        }
        else {
            this.status = 200;
            this.statusText = "";
            this.headers = new Headers();
        }
    }
}
const dnsServers = [
    "1.1.1.1",
    "1.0.0.1",
    "[2606:4700:4700::1111]",
    "[2606:4700:4700::1001]"
];
dns.setServers(dnsServers);
dns.promises.setServers(dnsServers);
const agentOp = {
// lookup: async (hostname: string, options: dns.LookupOneOptions, callback: (err: any, address: string, family: number) => void) => {
// 	dns.resolve4(hostname, (err, addr) => {
// 		if (err != null) {
// 			callback(err, "", 0);
// 			return;
// 		}
// 		callback(void 0, addr[0], 4);
// 	});
// }
};
const httpAgent = new HttpAgent(agentOp);
const httpsAgent = new HttpsAgent(agentOp);
function decodeProtocol(protocol) {
    let result = "";
    for (let i = 0; i < protocol.length; i++) {
        const ch = protocol[i];
        if (ch === "%") {
            const code = parseInt(protocol.slice(i + 1, i + 3), 16);
            result += String.fromCharCode(code);
            i += 2;
        }
        else
            result += ch;
    }
    return result;
}
function rawHeaderNames(raw) {
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
        if (!result.includes(raw[i]))
            result.push(raw[i]);
    }
    return result;
}
function mapHeadersFromArray(from, to) {
    for (let h of from) {
        const header = h.toLowerCase();
        if (header in to) {
            const value = to[header];
            delete to[header];
            to[header] = value;
        }
    }
    return to;
}
/**
 * Converts a header into an HTTP-ready comma joined header.
 */
function flattenHeader(value) {
    return Array.isArray(value) ? value.join(', ') : value;
}
function fetch(request, requestHeaders, url) {
    const options = {
        host: url.host,
        port: url.port,
        path: url.path,
        method: request.method,
        headers: requestHeaders,
        setHost: false
    };
    const outgoing = url.protocol == "https:" ? httpsRequest(Object.assign(Object.assign({}, options), { agent: httpsAgent })) : httpRequest(Object.assign(Object.assign({}, options), { agent: httpAgent }));
    request.body.pipe(outgoing);
    return new Promise((resolve, reject) => {
        outgoing.on("response", resolve);
        outgoing.on("error", reject);
    });
}
function upgradeFetch(request, requestHeaders, url) {
    const options = {
        host: url.host,
        port: url.port,
        path: url.path,
        method: request.method,
        headers: requestHeaders,
        setHost: false
    };
    const outgoing = url.protocol == "wss:" ? httpsRequest(Object.assign(Object.assign({}, options), { agent: httpsAgent })) : httpRequest(Object.assign(Object.assign({}, options), { agent: httpAgent }));
    outgoing.end();
    return new Promise((resolve, reject) => {
        outgoing.on("response", () => {
            reject("Remote did not upgrade the WebSocket");
        });
        outgoing.on("upgrade", (request, socket, head) => {
            resolve([request, socket, head]);
        });
        outgoing.on("error", reject);
    });
}
class Server {
    constructor(directory) {
        this.routes = new Map();
        this.socketRoutes = new Map();
        this.directory = directory;
    }
    routeUpgrade(req, socket, head) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = new Request(req);
            const service = request.url.pathname.slice(this.directory.length - 1);
            if (this.socketRoutes.has(service)) {
                const call = this.socketRoutes.get(service);
                yield call(request, socket, head);
                return true;
            }
            return false;
        });
    }
    routeRequest(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = new Request(req);
            const service = request.url.pathname.slice(this.directory.length - 1);
            if (this.routes.has(service)) {
                const call = this.routes.get(service);
                return yield call(request);
            }
            return null;
        });
    }
}
const randomBytesAsync = promisify(randomBytes);
function loadForwardedHeaders(forward, target, request) {
    for (const header of forward) {
        if (request.headers.has(header)) {
            target[header] = request.headers.get(header);
        }
    }
}
function readHeaders(request) {
    const remote = {};
    const headers = {};
    Reflect.setPrototypeOf(headers, null);
    for (const remoteProp of ['host', 'port', 'protocol', 'path']) {
        const header = `x-bare-${remoteProp}`;
        if (request.headers.has(header)) {
            const value = request.headers.get(header);
            remote[remoteProp] = value;
        }
    }
    if (request.headers.has('x-bare-headers')) {
        const json = JSON.parse(request.headers.get('x-bare-headers'));
        Object.assign(headers, json);
    }
    if (request.headers.has('x-bare-forward-headers')) {
        const json = JSON.parse(request.headers.get('x-bare-forward-headers'));
        loadForwardedHeaders(json, headers, request);
    }
    return { remote: remote, headers };
}
function tunnelRequest(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const { remote, headers } = readHeaders(request);
        const response = yield fetch(request, headers, remote);
        const responseHeaders = new Headers();
        for (const header in response.headers) {
            if (header === 'content-encoding' || header === 'x-content-encoding')
                responseHeaders.set('content-encoding', flattenHeader(response.headers[header]));
            else if (header === 'content-length')
                responseHeaders.set('content-length', flattenHeader(response.headers[header]));
        }
        responseHeaders.set('x-bare-headers', JSON.stringify(mapHeadersFromArray(rawHeaderNames(response.rawHeaders), Object.assign({}, response.headers))));
        responseHeaders.set('x-bare-status', response.statusCode.toString());
        responseHeaders.set('x-bare-status-text', response.statusMessage);
        return new Response(response, { status: 200, headers: responseHeaders });
    });
}
const tempMeta = new Map();
const metaExpiration = 30e3;
function wsMeta(request) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (request.method === 'OPTIONS') {
            return new Response(undefined, { status: 200 });
        }
        const id = request.headers.get('x-bare-id');
        const meta = tempMeta.get(id);
        tempMeta.delete(id);
        return new Response(Buffer.from(JSON.stringify({
            headers: (_a = meta.response) === null || _a === void 0 ? void 0 : _a.headers,
        }, undefined, '\t')), {
            status: 200,
            headers: new Headers({
                'content-type': 'application/json'
            })
        });
    });
}
function wsNewMeta() {
    return __awaiter(this, void 0, void 0, function* () {
        const id = (yield randomBytesAsync(32)).toString('hex');
        tempMeta.set(id, {
            set: Date.now(),
        });
        return new Response(Buffer.from(id));
    });
}
function tunnelSocket(request, socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!request.headers.has('sec-websocket-protocol')) {
            socket.end();
            return;
        }
        const [firstProtocol, data] = request.headers
            .get('sec-websocket-protocol')
            .split(/,\s*/g);
        if (firstProtocol !== 'bare') {
            socket.end();
            return;
        }
        const { remote, headers, forward_headers: forwardHeaders, id, } = JSON.parse(decodeProtocol(data));
        loadForwardedHeaders(forwardHeaders, headers, request);
        const [remoteResponse, remoteSocket] = yield upgradeFetch(request, headers, remote);
        if (tempMeta.has(id)) {
            tempMeta.get(id).response = {
                headers: mapHeadersFromArray(rawHeaderNames(remoteResponse.rawHeaders), Object.assign({}, remoteResponse.headers)),
            };
        }
        const responseHeaders = [
            `HTTP/1.1 101 Switching Protocols`,
            `Upgrade: websocket`,
            `Connection: Upgrade`,
            `Sec-WebSocket-Protocol: bare`,
            `Sec-WebSocket-Accept: ${remoteResponse.headers['sec-websocket-accept']}`,
        ];
        if ('sec-websocket-extensions' in remoteResponse.headers) {
            responseHeaders.push(`Sec-WebSocket-Extensions: ${remoteResponse.headers['sec-websocket-extensions']}`);
        }
        socket.write(responseHeaders.concat('', '').join('\r\n'));
        remoteSocket.on('close', () => {
            // console.log('Remote closed');
            socket.end();
        });
        socket.on('close', () => {
            // console.log('Serving closed');
            remoteSocket.end();
        });
        remoteSocket.on('error', (error) => {
            socket.end();
        });
        socket.on('error', (error) => {
            remoteSocket.end();
        });
        remoteSocket.pipe(socket);
        socket.pipe(remoteSocket);
    });
}
function registerV1(server) {
    server.routes.set('/v1/', tunnelRequest);
    server.routes.set('/v1/ws-new-meta', wsNewMeta);
    server.routes.set('/v1/ws-meta', wsMeta);
    server.socketRoutes.set('/v1/', tunnelSocket);
    setInterval(() => {
        for (const [id, meta] of tempMeta) {
            const expires = meta.set + metaExpiration;
            if (expires < Date.now()) {
                tempMeta.delete(id);
            }
        }
    }, 1000);
}
const bare = (directory) => {
    const server = new Server(directory);
    registerV1(server);
    return server;
};
export default bare;
