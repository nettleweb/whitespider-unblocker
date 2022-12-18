
/**
 * Server configurations
 */
const config = {
	/**
	 * The binding address for http and https server.
	 *  - '0.0.0.0' - bind every reachable address.
	 *  - '127.0.0.1' - bind localhost only.
	 * @type {string}
	 * @default "0.0.0.0"
	 */
	address: "0.0.0.0",
	/**
	 * The port for http server, set to 0 or null to disable.
	 * @type {number | null | undefined}
	 * @default 80
	 */
	httpPort: 80,
	/**
	 * The port for https server, set to 0 or null to disable
	 * @type {number | null | undefined}
	 * @default 443
	 */
	httpsPort: 443,
	/**
	 * The http headers for non-error (status=200) responses.
	 * @type {object}
	 */
	headers: {
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
		"X-Content-Type-Options": "nosniff"
	},
	/**
	 * The http headers for error responses.
	 * @type {object}
	 */
	errorHeaders: {
		"Content-Security-Policy": "default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; media-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; frame-ancestors 'none';",
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "SAMEORIGIN",
		"X-Robots-Tag": "noindex,nofollow"
	},
	/**
	 * A list of allowed hosts.
	 * Users may only connect from one of the following hostname.
	 * It will return 403 error if user tried to connect from a hostname that is not listed here.
	 * @type {string[]}
	 */
	allowedHosts: [
		"googlecom.gq",
		"unblocker.whitespider.cf",
		"unblocker.whitespider.ga",
		"unblocker.whitespider.gq",
		"unblocker.whitespider.ml",
		"unblocker.whitespider.tk",
		"wsu.repl.ga",
		"localhost"
	],
	/**
	 * The path where SSL certificate is located, only useful when https is enabled.
	 * @type {string}
	 */
	certPath: "../cert/cert.pem",
	/**
	 * The path where SSL private key is located, only useful when https is enabled.
	 * @type {string}
	 */
	privKeyPath: "../cert/privkey.pem",
	/**
	 * Configurations for Tomcat server
	 */
	tomcat: {
		/**
		 * @type {string | null | undefined}
		 * @default null
		 */
		torProxyAddress: "socks5://127.0.0.1:9050",
		/**
		 * @type {string | null | undefined}
		 * @default null
		 */
		proxyAddress: null
	},
	/**
	 * @type {boolean}
	 * @default true
	 */
	allowPing: true
};

// binding provided port in env is required by some hosting providers
const portEnv = process.env.PORT;
if (portEnv != null) {
	const port = parseInt(portEnv);
	if (!isNaN(port)) {
		config.httpPort = port;
		config.httpsPort = 0;
	}
}

export default config;
