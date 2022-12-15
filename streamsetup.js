import net from "net";
import tty from "tty";
import util from "util";

const stdout = process.stdout;
const stderr = process.stderr;
const stdin = process.stdin;

/**
 * @type {'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex'}
 */
const NodeJsEnoding_t = "";

/**
 * @param {net.Socket} stream 
 * @param {typeof NodeJsEnoding_t} encoding 
 */
function streamSetup(stream, encoding) {
	"use strict";

	class LogicError extends Error {
		/**
		 * @param {string | undefined} message 
		 */
		constructor(message) {
			switch (typeof message) {
				case "string":
				case "undefined":
					break;
				default:
					throw new LogicError("Variable message must be a string.")
			}
			super(message);
		}

		stack = null;
		toString = null;
		toLocaleString = null;
	}

	/**
	 * @param {any} v 
	 * @param {string} vn 
	 * @param {string} req 
	 */
	function typeck(v, vn, req) {
		if (typeof vn != "string" || typeof req != "string")
			throw new LogicError("Variable 'vn' and 'req' must be string.");
		if (typeof v != req)
			throw new Error(`Invalid value for '${vn}', required type: '${req}'.`);
	}

	/**
	 * @param {any} v 
	 * @param {string} vn 
	 * @param {string | function} req 
	 */
	function instck(v, vn, req) {
		if (typeof vn != "string")
			throw new LogicError("Variable 'vn' must be a string.");
		switch (typeof req) {
			case "string":
				const type = req;
				req = globalThis[type];
				if (typeof req != "function")
					throw new Error(`Cannot find type ${type} in global scope.`);
				break;
			case "function":
				break;
			default:
				throw new Error("Variable 'req' must be a function or a string.");
		}

		if (!(v instanceof req)) {
			throw new Error(`Variable '${vn}' must be an instance of '${req.name}'.`)
		}
	}

	typeck(encoding, "encoding", "string");
	instck(stream, "stream", net.Socket);

	stream.setDefaultEncoding("utf-8");
	stream.setEncoding(encoding);
	stream.setKeepAlive(true);
	stream.setNoDelay(true);
	stream.setMaxListeners(0);
	stream.setTimeout(5000);

	/**
	 * @type {((buf: ArrayBufferLike | ArrayLike<number> | string) => void) | null}
	 */
	let writeHook = null;

	/**
	 * @param {ArrayBufferLike | ArrayLike<number> | string} buf 
	 */
	function Stream(buf) {
		if (writeHook != null) {
			// hook override
			writeHook(buf);
			return _this;
		}

		switch (typeof buf) {
			case "string":
				stream.write(buf, encoding);
				break;
			case "object":
				stream.write(new Uint8Array(buf));
				break;
			default:
				throw new Error("Buffer value must be string or ArrayBuffer");
		}
		return _this;
	}

	const _this = Stream;

	/**
	 * @param {ArrayBufferLike | ArrayLike<number> | string} buf 
	 */
	function writeln(buf) {
		Stream(buf).write("\n");
		return _this;
	}

	/**
	 * @param {string[]} str 
	 */
	function print(...str) {
		for (let s of str)
			Stream(s);
		return _this;
	}

	/**
	 * @param {string[]} lines 
	 */
	function println(...lines) {
		for (let l of lines)
			writeln(l);
		return _this;
	}

	/**
	 * @param {string} baseStr 
	 * @param {string[]} str 
	 */
	function inject(baseStr, ...str) {
		print(baseStr.replace(/%s/g, str.join(" ")));
		return _this;
	}

	/**
	 * @param {string} baseStr 
	 * @param  {string[]} str 
	 */
	function injectln(baseStr, ...str) {
		println(baseStr.replace(/%s/g, str.join(" ")));
		return _this;
	}

	function timestamp() {
		print(new Date().toLocaleString("POSIX", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false
		}), " ");
		return _this;
	}

	function flush() {
		return _this;
	}

	/**
	 * @param {ArrayBufferLike | ArrayLike<number> | string | undefined} message 
	 */
	function close(message) {
		switch (typeof message) {
			case "string":
				stream.end(message, encoding);
				break;
			case "object":
				stream.end(new Uint8Array(buf));
				break;
			case "undefined":
				stream.end();
				break;
			default:
				throw new Error("Message must be string or ArrayBuffer");
		}
		return _this;
	}

	function clone() {
		if (stream.closed)
			throw new Error("Stream closed");

		return streamSetup(stream, encoding);
	}

	/**
	 * @param {typeof NodeJsEnoding_t} encoding 
	 */
	function encode(encoding) {
		const alt = clone();
		alt.encoding = encoding;
		return alt;
	}

	/**
	 * @param {string} event 
	 * @param {(...args: any[]) => void} listener 
	 */
	function on(event, listener) {
		stream.on(event, listener);
		return _this;
	}

	/**
	 * @param {string} event 
	 * @param {(...args: any[]) => void} listener 
	 */
	function once(event, listener) {
		stream.once(event, listener);
		return _this;
	}

	/**
	 * @param {string} event 
	 * @param {(...args: any[]) => void} listener 
	 */
	function off(event, listener) {
		stream.off(event, listener);
		return _this;
	}

	/**
	 * @param {string | undefined} event 
	 */
	function removeAllListeners(event) {
		stream.removeAllListeners(event);
		return _this;
	}

	/**
	 * @param {string} event 
	 * @param  {any[]} args 
	 */
	function emit(event, ...args) {
		stream.emit(event, ...args);
		return _this;
	}

	/**
	 * @private
	 * @returns {never}
	 */
	function never() {
		throw "";
	}

	Stream.write = Stream;
	Stream.writeln = writeln;
	Stream.print = print;
	Stream.println = println;
	Stream.inject = inject;
	Stream.injectln = injectln;
	Stream.timestamp = timestamp;
	Stream.printTimestamp = timestamp;
	Stream.flush = flush;
	Stream.close = close;
	Stream.end = close;
	Stream.clone = clone;
	Stream.encode = encode;
	Stream.on = on;
	Stream.once = once;
	Stream.off = off;
	Stream.addListener = on;
	Stream.removeListener = off;
	Stream.removeAllListeners = removeAllListeners;
	Stream.emit = emit;
	Stream.toString = never;
	Stream.toJSON = never;

	Object.defineProperty(Stream, "encoding", {
		get: () => encoding,
		set: (v) => {
			typeck(v, "encoding", "string");
			stream.setEncoding(v);
			encoding = v;
		},
		enumerable: false,
		configurable: false
	});
	Object.defineProperty(Stream, "writeHook", {
		get: () => writeHook,
		set: (v) => {
			if (v != null)
				typeck(v, "writeHook", "function");
			writeHook = v;
		},
		enumerable: false,
		configurable: false		
	});
	Object.defineProperty(Stream, "closed", {
		get: () => stream.closed,
		enumerable: false,
		configurable: false
	});
	Object.defineProperty(Stream, "isTTY", {
		value: stream instanceof tty.WriteStream ? stream.isTTY : false,
		writable: false,
		enumerable: false,
		configurable: false
	});

	if (stream instanceof tty.WriteStream) {
		/**
		 * @param {number | undefined} x 
		 * @param {number | undefined} y 
		 */
		const cusTo = (x, y) => {
			stream.cursorTo(x, y);
			return _this;
		};
		/**
		 * @param {number | undefined} dx 
		 * @param {number | undefined} dy 
		 */
		const moveCus = (dx, dy) => {
			stream.moveCursor(dx, dy);
			return _this;
		};
		/**
		 * @param {number} direction 
		 */
		const clearLine = (direction = 0) => {
			stream.clearLine(direction);
			stream.cursorTo(0);
			return _this;
		};
		const clear = () => {
			stream.cursorTo(0, 0);
			stream.clearScreenDown();
			return _this;
		};
		/**
		 * @param {string} string 
		 */
		const rewrite = (string) => {
			clear();
			println(string);
			return _this;
		};
		/**
		 * @param {string} string 
		 * @param {number} count
		 */
		const rewriteLine = (string, count = 1) => {
			clearLine();
			for (let i = 1; i < count; i++) {
				moveCus(0, -1);
				clearLine();
			}
			print(string);
			return _this;
		};
		/**
		 * @param {number | string} code 
		 */
		const color = (code) => {
			const alt = clone();
			alt.writeHook = (buf) => {
				Stream(`\x1b[${code}m`).write(buf).write("\x1b[0m");
				return _this;
			};
			return alt;
		};

		Stream.curTo = cusTo;
		Stream.moveCus = moveCus;
		Stream.clearLine = clearLine;
		Stream.clear = clear;
		Stream.rewrite = rewrite;
		Stream.rewriteLine = rewriteLine;
		Stream.color = color;
	} else {
		const stub = () => _this;
		Stream.curTo = stub;
		Stream.moveCus = stub;
		Stream.clearLine = stub;
		Stream.clear = stub;
		Stream.rewrite = stub;
		Stream.rewriteLine = stub;
		Stream.color = stub;
	}

	return _this;
}

const out = streamSetup(stdout, "ascii");
const err = streamSetup(stderr, "ascii");
const _in = streamSetup(stdin, "ascii");
const std = { out, err, in: _in };

// hook console methods
const logFormatOptions = {
	compact: true,
	sorted: true,
	colors: true,
	depth: 4,
	maxArrayLength: 0xffff,
	maxStringLength: 0xffff
};
console.info = console.log = (...args) => out.timestamp().println(util.formatWithOptions.apply(void 0, [logFormatOptions, ...args]));
console.warn = console.error = (...args) => err.timestamp().println(util.formatWithOptions.apply(void 0, [logFormatOptions, ...args]));

/**
 * @param {number} time 
 * @returns {Promise<void>}
 */
const lock = (time) => {
	return new Promise(r => setTimeout(r, time));
};

streamSetup.stdout = streamSetup.out = out;
streamSetup.stderr = streamSetup.err = err;
streamSetup.stdin = streamSetup.in = _in;
streamSetup.std = std;
streamSetup.lock = lock;

export default streamSetup;
export { out, err, _in as in, std, lock, streamSetup };
