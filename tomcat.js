import * as puppeteer from "puppeteer";
import { Server } from "socket.io";

//////////////////////////
// BROWSER / Core APIs
/////////////////////////

const browser = await puppeteer.launch({
	headless: true,
	defaultViewport: {
		width: 1280,
		height: 720,
		hasTouch: false,
		isLandscape: true,
		isMobile: false,
		deviceScaleFactor: 1
	},
	args: [
		"--disable-gpu",
		"--window-size=1280,720"
	],
	pipe: true,
	timeout: 10000
});

/**
 * @type {({ readonly page: puppeteer.Page; readonly quality: number; } | null | undefined)[]}
 */
const clients = [];

/**
 * @param {{ readonly quality: number; readonly width: number; readonly height: number; } | null | undefined} config 
 */
async function newSession(config) {
	if (config == null) {
		console.warn("Session creation ignored, invalid configuration detected");
		return;
	}

	const context = await browser.createIncognitoBrowserContext();
	const page = await context.newPage();
	await page.setCacheEnabled(true);
	await page.setJavaScriptEnabled(true);
	await page.setGeolocation({
		accuracy: 0,
		latitude: 0,
		longitude: 0
	});
	await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0", {
		architecture: "",
		bitness: "",
		brands: [],
		fullVersion: "",
		fullVersionList: [],
		mobile: false,
		model: "",
		platform: "",
		platformVersion: "",
		wow64: false
	});

	// parse dimension string
	const width = config.width || 1280;
	const height = config.height || 720;
	if (width < 1024 || width > 1920 || height < 720 || height > 1080) {
		console.warn("Session creation ignored, because invalid dimension configuration detected.");
		return -1;
	}

	// set display dimension
	await page.setViewport({
		width,
		height,
		hasTouch: false,
		isLandscape: true,
		isMobile: false,
		deviceScaleFactor: 1
	});

	// hook popups, force open them in current window
	context.on("targetcreated", async (e) => {
		const opener = e.opener();
		if (opener != null) {
			const page = await opener.page();
			await page.goto(e.url(), {
				referer: opener.url(),
				timeout: 10000,
				waitUntil: "domcontentloaded"
			});
		}
	});

	const id = clients.length;
	clients[id] = {
		page,
		quality: parseInt(config.quality || 50)
	};
	return id;
}

/**
 * @param {number} id 
 */
function hasSession(id) {
	return clients[id] != null;
}

/**
 * @param {string} url 
 */
function checkUrl(url) {
	const hostname = new URL(url).hostname;
	// for security reasons, reject all requests to localhost
	if (hostname == "localhost")
		return false;
	
	// reject access to lan
	const n = hostname.split(".");
	if (n.length == 4) {
		if (n[0] == "10") // 10.0.0.0/8
			return false;
		if (n[0] == "127") // 127.0.0.0/8
			return false;
		if (n[0] == "192" && n[1] == "168") // 192.168.0.0/16
			return false;
	}
	return true;
}

/**
 * @param {number} id 
 * @param {string} url 
 */
async function navigate(id, url) {
	try {
		const page = clients[id].page;
		if (!checkUrl(url))
			url = "http://google.com";

		await page.goto(url, {
			referer: "",
			waitUntil: "domcontentloaded",
			timeout: 20000
		});
		return true;
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 */
async function sync(id) {
	try {
		const client = clients[id];
		const page = client.page;
		const buf = await page.screenshot({
			encoding: "binary",
			fromSurface: true,
			quality: client.quality,
			type: "jpeg",
			fullPage: false
		});
		return {
			buf: buf instanceof Buffer ? buf.buffer : null,
			url: page.url()
		};
	} catch(err) {
		console.log(err);
		return null;
	}
}

/**
 * @param {number} id 
 * @param {{ readonly type: string; readonly x: number; readonly y: number; readonly button: string; }} event 
 */
async function dispatchMouseEvent(id, event) {
	try {
		const page = clients[id].page;
		const type = event.type;
		const x = event.x;
		const y = event.y;
		const button = event.button;

		switch (type) {
			case "contextmenu":
			case "click":
				// deprecated
				await page.mouse.click(x, y, { button });
				return true;
			case "mousedown":
				await page.mouse.down({ button, clickCount: 1 });
				return true;
			case "mouseup":
				await page.mouse.up({ button, clickCount: 1 });
				return true;
			case "mousemove":
				await page.mouse.move(x, y, { steps: 1 });
				return true;
			default:
				throw new Error("Invalid event type: " + type);
		}
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 * @param {{ readonly type: string; readonly deltaX: number; readonly deltaY: number; }} event 
 */
async function dispatchWheelEvent(id, event) {
	try {
		const page = clients[id].page;
		const type = event.type;
		const deltaX = event.deltaX;
		const deltaY = event.deltaY;

		switch (type) {
			case "wheel":
				await page.mouse.wheel({ deltaX, deltaY });
				return true;
			default:
				throw new Error("Invalid event type: " + type);
		}
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 * @param {{ readonly type: string; readonly x: number; readonly y: number; }} event 
 */
async function dispatchTouchEvent(id, event) {
	try {
		const page = clients[id].page;
		const type = event.type;
		const x = event.x;
		const y = event.y;

		switch (type) {
			case "touchend":
				await page.touchscreen.tap(x, y);
				return true;
			default:
				throw new Error("Invalid event type: " + type);
		}
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 * @param {{ readonly type: string; readonly key: string; }} event 
 */
async function dispatchKeyboardEvent(id, event) {
	try {
		const page = clients[id].page;
		const type = event.type;
		const key = event.key;

		switch (type) {
			case "keydown":
				await page.keyboard.down(key);
				return true;
			case "keyup":
				await page.keyboard.up(key);
				return true;
			case "keypress":
				await page.keyboard.press(key);
				return true;
			default:
				throw new Error("Invalid event type: " + type);
		}
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 * @param {{ readonly type: string; readonly data: string; }} event 
 */
async function dispatchInputEvent(id, event) {
	try {
		const page = clients[id].page;
		const type = event.type;
		const data = event.data;

		switch (type) {
			case "input":
				// deprecated
				await page.keyboard.sendCharacter(data);
				return true;
			default:
				throw new Error("Invalid event type: " + type);
		}
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 */
async function goBack(id) {
	try {
		const page = clients[id].page;
		return await page.goBack({
			waitUntil: "domcontentloaded",
			timeout: 15000
		}) != null;
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 */
async function goForward(id) {
	try {
		const page = clients[id].page;
		return await page.goForward({
			waitUntil: "domcontentloaded",
			timeout: 15000
		}) != null;
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 */
async function refresh(id) {
	try {
		const page = clients[id].page;
		return await page.reload({
			waitUntil: "domcontentloaded",
			timeout: 15000
		}) != null;
	} catch(err) {
		console.log(err);
		return false;
	}
}

/**
 * @param {number} id 
 */
async function endSession(id) {
	try {
		const page = clients[id].page;
		await page.close({ runBeforeUnload: false });
		await page.browserContext().close();
		delete clients[id];
		return true;
	} catch(err) {
		console.log(err);
		return false;
	}
}

const tomcat = {
	newSession,
	hasSession,
	navigate,
	sync,
	dispatchMouseEvent,
	dispatchWheelEvent,
	dispatchTouchEvent,
	dispatchKeyboardEvent,
	dispatchInputEvent,
	goBack,
	goForward,
	refresh,
	endSession
};


//////////////////////////
// Extended APIs for NodeJs http server
//////////////////////////

function bind(httpServer) {
	const io = new Server(httpServer, {
		cors: {
			methods: "none",
			origin: "none",
			credentials: true
		},
		connectTimeout: 25000,
		pingTimeout: 8000,
		pingInterval: 20000,
		httpCompression: true,
		perMessageDeflate: true,
		upgradeTimeout: 8000,
		destroyUpgrade: true,
		destroyUpgradeTimeout: 1000,
		maxHttpBufferSize: 1024
	});

	io.on("connection", (socket) => {
		// emit connect message again to notify the client
		socket.emit("connected", true);
		socket.setMaxListeners(0);

		socket.on("new_session", async (prop) => {
			const id = await tomcat.newSession(prop);
			socket.emit("session_id", id);

			socket.on("sync", async () => {
				if (hasSession(id)) {
					const data = await sync(id);
					if (data != null) {
						socket.emit("data", data);
					}
				} else socket.emit("force_reconnect");
			});
			socket.on("disconnect", async () => {
				await endSession(id);
				socket.removeAllListeners();
				socket.disconnect(true);
			});

			// event listeners
			socket.on("mouseevent", (e) => hasSession(id) ? dispatchMouseEvent(id, e) : socket.emit("force_reconnect"));
			socket.on("wheelevent", (e) => hasSession(id) ? dispatchWheelEvent(id, e) : socket.emit("force_reconnect"));
			socket.on("touchevent", (e) => hasSession(id) ? dispatchTouchEvent(id, e) : socket.emit("force_reconnect"));
			socket.on("keyboardevent", (e) => hasSession(id) ? dispatchKeyboardEvent(id, e) : socket.emit("force_reconnect"));
			socket.on("inputevent", (e) => hasSession(id) ? dispatchInputEvent(id, e) : socket.emit("force_reconnect"));
			socket.on("goback", () => hasSession(id) ? goBack(id) : socket.emit("force_reconnect"));
			socket.on("goforward", () => hasSession(id) ? goForward(id) : socket.emit("force_reconnect"));
			socket.on("refresh", () => hasSession(id) ? refresh(id) : socket.emit("force_reconnect"));
			socket.on("navigate", (url) => hasSession(id) ? navigate(id, url) : socket.emit("force_reconnect"));
		});
	});
};

export { bind };
export default tomcat;
