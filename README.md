# WhiteSpider Unblocker
Unblock websites through a proxy server, bypass the restrictions of local network and browser extensions. <br />
Link to website: https://unblocker.whitespider.gq <br />
Alternative link: https://unblocker.ruochenjia.repl.co

## Features
 - Supports most common websites, like YouTube, Instagram, Discord
 - Supports reCAPTCHA and hCAPTCHA
 - Supports history hiding

## Known Issues
 - Service workers are not supported
 - Cookie popups appear again after refreshing in some websites
 - Server address does not change immediately after changing in settings

## Quick Start
1. Clone this repository to your server.
```sh
$ git clone https://github.com/ruochenjia/whitespider-unblocker.git
```
2. Install dependencies.
```sh
$ cd whitespider-unblocker
$ npm install
```
3. Start the server, you may need to edit `config.js` before starting.
```sh
$ npm run start
```

## Mirror Links
If the links provided here have been restricted, you can visit https://sites.google.com/view/wsug-mirrors to get a list of mirror links. <br />
Mirrors can be slower than the main link, only use them when you really need.

## License
This repository is licensed under Apache-2.0 license, see `LICENSE.md` for more details.

## Libraries used
 - <a href="https://github.com/titaniumnetwork-development/Ultraviolet" target="_blank">Ultraviolet</a> (Modified)
 - <a href="https://github.com/ruochenjia/webalert" target="_blank">webalert.js</a>
