import { IncomingMessage, RequestOptions, Agent as HttpAgent, request as httpRequest } from "http";
import { Agent as HttpsAgent, request as httpsRequest } from "https";
import { Stream, Duplex } from "stream";
import { Headers } from "headers-polyfill";
import { randomBytes } from "crypto";
import { promisify } from "util";

type ResponseBody = Buffer | Stream | undefined;
type BareHeaders = Record<string, string | string[]>;
interface ResponseInit { headers?: Headers; status?: number; statusText?: string; }
interface BareRemote { host: string; port: number | string; path: string; protocol: string; }
interface BareHeaderData { remote: BareRemote; headers: BareHeaders; }
interface Meta { response?: { headers: BareHeaders; }; set: number; }

class Request {
	readonly body: Stream;
	readonly method: string;
	readonly headers: Headers;
	readonly url: URL;
	readonly query: URLSearchParams;

	constructor(base: IncomingMessage) {
		this.body = base;
		this.method = base.method!;
		this.headers = new Headers(base.headers);
		this.url = new URL(`https://${this.headers.get("host")}${base.url}`);
		this.query = this.url.searchParams;
	}
}

class Response {
	readonly body: ResponseBody;
	readonly status: number;
	readonly statusText: string;
	readonly headers: Headers;

	constructor(body: ResponseBody, init?: ResponseInit) {
		this.body = body;
		if (init != null) {
			this.status = init.status == null ? 200 : init.status;
			this.statusText = init.statusText == null ? "" : init.statusText;
			this.headers = new Headers(init.headers);
		} else {
			this.status = 200;
			this.statusText = "";
			this.headers = new Headers();
		}
	}
}

const httpAgent = new HttpAgent({ hints: 0 });
const httpsAgent = new HttpsAgent({});

function decodeProtocol(protocol: string) {
	let result = "";

	for (let i = 0; i < protocol.length; i++) {
		const ch = protocol[i];

		if (ch === "%") {
			const code = parseInt(protocol.slice(i + 1, i + 3), 16);
			result += String.fromCharCode(code);
			i += 2;
		} else result += ch;
	}

	return result;
}

function rawHeaderNames(raw: string[]) {
	const result: string[] = [];

	for (let i = 0; i < raw.length; i += 2) {
		if (!result.includes(raw[i]))
			result.push(raw[i]);
	}

	return result;
}

function mapHeadersFromArray(from: string[], to: BareHeaders) {
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
function flattenHeader(value: string | string[]) {
	return Array.isArray(value) ? value.join(', ') : value;
}

function fetch(request: Request, requestHeaders: BareHeaders, url: BareRemote): Promise<IncomingMessage> {
	const options : RequestOptions = {
		host: url.host,
		port: url.port,
		path: url.path,
		method: request.method,
		headers: requestHeaders,
		setHost: false
	};

	const outgoing = url.protocol == "https:" ? httpsRequest({ ...options, agent: httpsAgent }) : httpRequest({ ...options, agent: httpAgent });

	request.body.pipe(outgoing);

	return new Promise((resolve, reject) => {
		outgoing.on("response", resolve);
		outgoing.on("error", reject);
	});
}

function upgradeFetch(request: Request, requestHeaders: BareHeaders, url: BareRemote): Promise<[IncomingMessage, Duplex, Buffer]> {
	const options = {
		host: url.host,
		port: url.port,
		path: url.path,
		headers: requestHeaders,
		method: request.method,
		setHost: false
	};

	const outgoing = url.protocol == "wss:" ? httpsRequest({ ...options, agent: httpsAgent }) : httpRequest({ ...options, agent: httpAgent });

	outgoing.end();

	return new Promise((resolve, reject) => {
		outgoing.on("response", () => {
			reject("Remote did not upgrade the WebSocket");
		});

		outgoing.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
			resolve([request, socket, head]);
		});

		outgoing.on("error", reject);
	});
}

class Server {
	readonly routes = new Map();
	readonly socketRoutes = new Map();
	readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	async routeUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
		const request = new Request(req);
		const service = request.url.pathname.slice(this.directory.length - 1);

		if (this.socketRoutes.has(service)) {
			const call = this.socketRoutes.get(service)!;
			await call(request, socket, head);
			return true;
		}

		return false;
	}

	async routeRequest(req: IncomingMessage): Promise<Response | null> {
		const request = new Request(req);
		const service = request.url.pathname.slice(this.directory.length - 1);

		if (this.routes.has(service)) {
			const call = this.routes.get(service)!;
			return await call(request);
		}

		return null;
	}
}

const randomBytesAsync = promisify(randomBytes);

function loadForwardedHeaders(forward: string[], target: BareHeaders, request: Request) {
	for (const header of forward) {
		if (request.headers.has(header)) {
			target[header] = request.headers.get(header)!;
		}
	}
}

function readHeaders(request: Request): BareHeaderData {
	const remote: Partial<BareRemote> & { [key: string]: string | number } = {};
	const headers: BareHeaders = {};
	Reflect.setPrototypeOf(headers, null);

	for (const remoteProp of ['host', 'port', 'protocol', 'path']) {
		const header = `x-bare-${remoteProp}`;

		if (request.headers.has(header)) {
			const value = request.headers.get(header)!;
			remote[remoteProp] = value;
		}
	}

	if (request.headers.has('x-bare-headers')) {
		const json = JSON.parse(request.headers.get('x-bare-headers')!);
		Object.assign(headers, json);
	}

	if (request.headers.has('x-bare-forward-headers')) {
		const json = JSON.parse(request.headers.get('x-bare-forward-headers')!);
		loadForwardedHeaders(json, headers, request);
	}

	return { remote: <BareRemote>remote, headers };
}

async function tunnelRequest(request: Request): Promise<Response> {
	const { remote, headers } = readHeaders(request);
	const response = await fetch(request, headers, remote);
	const responseHeaders = new Headers();

	for (const header in response.headers) {
		if (header === 'content-encoding' || header === 'x-content-encoding')
			responseHeaders.set(
				'content-encoding',
				flattenHeader(response.headers[header]!)
			);
		else if (header === 'content-length')
			responseHeaders.set(
				'content-length',
				flattenHeader(response.headers[header]!)
			);
	}

	responseHeaders.set(
		'x-bare-headers',
		JSON.stringify(
			mapHeadersFromArray(rawHeaderNames(response.rawHeaders), {
				...(<BareHeaders>response.headers),
			})
		)
	);

	responseHeaders.set('x-bare-status', response.statusCode!.toString());
	responseHeaders.set('x-bare-status-text', response.statusMessage!);

	return new Response(response, { status: 200, headers: responseHeaders });
}

const tempMeta: Map<string, Meta> = new Map();
const metaExpiration = 30e3;

async function wsMeta(request: Request): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return new Response(undefined, { status: 200 });
	}

	const id = request.headers.get('x-bare-id')!;
	const meta = tempMeta.get(id)!;
	tempMeta.delete(id);

	return new Response(Buffer.from(JSON.stringify({
		headers: meta.response?.headers,
	}, undefined, '\t')), {
		status: 200,
		headers: new Headers({
			'content-type': 'application/json'
		})
	});
}

async function wsNewMeta(): Promise<Response> {
	const id = (await randomBytesAsync(32)).toString('hex');

	tempMeta.set(id, {
		set: Date.now(),
	});

	return new Response(Buffer.from(id));
}

async function tunnelSocket(request: Request, socket: Duplex) {
	if (!request.headers.has('sec-websocket-protocol')) {
		socket.end();
		return;
	}

	const [firstProtocol, data] = request.headers
		.get('sec-websocket-protocol')!
		.split(/,\s*/g);

	if (firstProtocol !== 'bare') {
		socket.end();
		return;
	}

	const {
		remote,
		headers,
		forward_headers: forwardHeaders,
		id,
	} = JSON.parse(decodeProtocol(data));

	loadForwardedHeaders(forwardHeaders, headers, request);

	const [remoteResponse, remoteSocket] = await upgradeFetch(request, headers, remote);

	if (tempMeta.has(id)) {
		tempMeta.get(id)!.response = {
			headers: mapHeadersFromArray(rawHeaderNames(remoteResponse.rawHeaders), {
				...(<BareHeaders>remoteResponse.headers),
			}),
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
		responseHeaders.push(
			`Sec-WebSocket-Extensions: ${remoteResponse.headers['sec-websocket-extensions']}`
		);
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
}

function registerV1(server: Server) {
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

const bare = (directory: string) => {
	const server = new Server(directory);
	registerV1(server);
	return server;
};

export default bare;
