import util from "util";

const _log = console.log;
const _warn = console.warn;
const _error = console.error;

console.log = (...args) => {
	_log.apply(console, [formatLog(...args)]);
};

console.warn = (...args) => {
	_warn.apply(console, [formatLog(...args)]);
};

console.error = (...args) => {
	_error.apply(console, [formatLog(...args)]);
};

function formatDate() {
	return new Date().toLocaleString("POSIX", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false
	});
}

function formatLog(...args) {
	let str = util.formatWithOptions({
		// getters: true,
		// colors: true,
		compact: false,
		sorted: true,
		maxArrayLength: 0xffff,
		maxStringLength: 0xffff
	}, "", ...args);
	return `${formatDate()} ${str}`;
}

export { formatDate, formatLog };
