import puppeteer from "puppeteer";
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
 * @type {(puppeteer.Page | null | undefined)[]}
 */
const clients = [];

async function newSession() {
	const context = await browser.createIncognitoBrowserContext();
	const page = await context.newPage();
	await page.setCacheEnabled(true);
	await page.setJavaScriptEnabled(true);
	await page.setGeolocation({ 
		accuracy: 0,
		latitude: 0,
		longitude: 0
	});
	await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36", {
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

	const id = clients.length;
	clients[id] = page;
	return id;
}

/**
 * @param {number} id 
 * @param {string} url 
 */
async function navigate(id, url) {
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return null;

	try {
		const buf = await page.screenshot({
			encoding: "binary",
			fromSurface: true,
			quality: 50,
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return false;
	
	try {
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
	const page = clients[id];
	if (page == null)
		return false;
	
	try {
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
	const page = clients[id];
	if (page == null)
		return false;
	
	try {
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
	const page = clients[id];
	if (page == null)
		return false;

	try {
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
		connectTimeout: 30000,
		pingTimeout: 10000,
		pingInterval: 20000,
		httpCompression: true,
		perMessageDeflate: true,
		destroyUpgrade: true,
		destroyUpgradeTimeout: 1000
	});

	io.on("connection", (socket) => {
		// emit connect message again to notify the client
		socket.emit("connected", true);

		socket.on("new_session", async () => {
			const id = await tomcat.newSession();
			console.log("new session", id);
			socket.emit("session_id", id);

			socket.on("sync", async () => {
				const data = await tomcat.sync(id);
				if (data != null) {
					socket.emit("data", data);
				}
			});

			socket.on("mouseevent", (e) => tomcat.dispatchMouseEvent(id, e));
			socket.on("wheelevent", (e) => tomcat.dispatchWheelEvent(id, e));
			socket.on("touchevent", (e) => tomcat.dispatchTouchEvent(id, e));
			socket.on("keyboardevent", (e) => tomcat.dispatchKeyboardEvent(id, e));
			socket.on("inputevent", (e) => tomcat.dispatchInputEvent(id, e));
			socket.on("goback", () => tomcat.goBack(id));
			socket.on("goforward", () => tomcat.goForward(id));
			socket.on("refresh", () => tomcat.refresh(id));
			socket.on("disconnect", () => tomcat.endSession(id));
			socket.on("navigate", url => tomcat.navigate(id, url));
		});
	});
};

export { bind };
export default tomcat;
