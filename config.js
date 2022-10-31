
/**
 * Configuration for http server
 */
const config = {
	/**
	 * Set the value to false to disable logging
	 * @type {boolean}
	 */
	debug: true,
	/**
	 * The binding address for http and https server.
	 *  - '0.0.0.0' for binding every reachable address
	 *  - '127.0.0.1' for binding localhost only
	 * @type {string}
	 */
	address: "0.0.0.0",
	/**
	 * The port for http server, set to 0 or null to disable
	 * @type {number | null | undefined}
	 */
	httpPort: 80,
	/**
	 * The port for https server, set to 0 or null to disable
	 * @type {number | null | undefined}
	 */
	httpsPort: 443,
	/**
	 * The http headers for non-error (status=200) responses
	 * @type {object}
	 */
	headers: {
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		// "X-Frame-Options": "SAMEORIGIN",
		// "X-Robots-Tag": "noindex,nofollow"
	},
	/**
	 * @type {object}
	 */
	bareHeaders: {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "*",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Expose-Headers": "*",
		"Access-Control-Max-Age": "14400",
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "SAMEORIGIN",
		"X-Robots-Tag": "noindex,nofollow"
	},
	/**
	 * The http headers for error responses (status != 200)
	 * @type {object}
	 */
	errorHeaders: {
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
		"mmcn.herokuapp.com",
		"localhost"
	],
	/**
	 * A path where SSL certificate is located, only useful when https is enabled
	 * @type {string}
	 */
	certPath: "../cert/cert1.pem",
	/**
	 * A path where SSL private key is located, only useful when https is enabled
	 * @type {string}
	 */
	privKeyPath: "../cert/privkey1.pem"
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
