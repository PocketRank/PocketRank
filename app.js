global.__app = __dirname;
global.__htmlRoot = __app + "/public/";
global.__ssl_default = __ssl_root + "mcbe.cf/";
global.__data = __app + "/data/";
global.__csv_data = __app + "/data/csv/";
global.__csv_total_data = __app + "/data/csv/total.csv";

global.__ssl_root = __app + "/ssl/";
global.__ssl_default = __ssl_root + "default/";

global.__state = [];
global.__client_id = ""; //naver client id
global.__client_secret = ""; //naver client secret

String.prototype.replaceAll = function (target, replacement) {
    return this.split(target).join(replacement);
};

const http = require("http");
const https = require("https");
const mime = require("mime-types");
const fs = require("fs");
const ModulePath = require("path");
const util = require("util");
const ejs = require("ejs");
const tls = require("tls");
const TLSSocket = tls.TLSSocket;
const beautifier = require("js-beautify");
const crypto = require('crypto');
const Cookies = require("cookies");

function getSecureContext(domain) {
    return tls.createSecureContext({
        key: fs.readFileSync(__ssl_root + domain + '/key.pem'),
        cert: fs.readFileSync(__ssl_root + domain + '/cert.pem') + "\n" + fs.readFileSync(__ssl_root + domain + '/ca.pem')
    }).context;
}

var secureContext = {
};

var options = {
    key: fs.readFileSync(__ssl_default + '/key.pem'),
    cert: fs.readFileSync(__ssl_default + '/cert.pem'),
    ca: fs.readFileSync(__ssl_default + '/ca.pem')
};

mime.types["ejs"] = mime.lookup("html");

global.api = require(__app + "/lib/response/ApiHandler");
const NaverLogin = require(__app + "/lib/response/NaverLogin");
const QueryService = require(__app + "/lib/query/QueryService");
const PlusFriend = require(__app + "/lib/response/PlusFriend");

const existsFile = async function (path) {
    try {
        await util.promisify(fs.access)(path);
    } catch (e) {
        return false;
    }
    return true;
};

const getBeautifier = function (ext, data) {
    let opts = {
        indent_size: 1,
        space_in_empty_paren: true,
        indent_with_tabs: true
    };
    if (ext === "text/html") {
        return beautifier.html_beautify(data, opts);
    }
    if (ext === "application/javascript") {
        return beautifier.js_beautify(data, opts);
    }
    if (ext === "text/css") {
        return beautifier.css_beautify(data, opts);
    }
    return data;
};

global.__query = new QueryService();
__query.start().catch(e => {
    console.log("[QueryService] 실행 실패");
    console.debug(e);
});


async function handleRequest(request, response) {
    let path = request.url.split("?")[0];
    let host = request.headers.host.match(/[^\.]*\.[^.]*$/)[0] || "pmmp.me";

    if (await existsFile(__htmlRoot + host + "/") && (await util.promisify(fs.stat)(__htmlRoot + host + "/")).isDirectory()) {
        host = __htmlRoot + host + "/";
    } else {
        host = __default_htmlRoot;
    }

    let realRoot = host;
    do {
        if (path === "/login" || path.indexOf("/login/") === 0) {
            NaverLogin.handleRequest(request, response);
            return;
        }
		let cookie = new Cookies(request, response);
		if (path === "/logout" || path.indexOf("/logout/") === 0) {
			cookie.set("refresh_token", "", {expires:  new Date(0), domain: "nlog.cf", path: "/"});
			cookie.set("access_token", "", {expires: new Date(0), domain: "nlog.cf", path: "/"});
			response.writeHead(301, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Location': 'https://' + request.headers.host + '/'
            });
            response.end();
			return;
		}
        if (await existsFile(realRoot + path)) {
            let realpath = "";
            if ((realpath = await util.promisify(fs.realpath)(realRoot + path))) {
                if (realpath === "") {
                    response.writeHead(404, {
                        'Content-Type': 'text/plain',
                        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                    });
                    response.end("Cannot GET " + path);
                    return;
                }
                if ((await util.promisify(fs.stat)(realpath)).isDirectory()) {
                    if (path.substr(-1) !== "/") {
                        response.writeHead(301, {
                            'Location': getProtocol(request) + "://" + request.headers.host + path + "/",
                            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                        });
                        response.end();
                        return;
                    }
                    if (await existsFile(realpath + "/index.html")) {
                        realpath += "/index.html";
                    } else {
                        if (await existsFile(realpath + "/index.ejs")) {
                            realpath += "/index.ejs";
                        } else {
                            response.writeHead(404, {
                                'Content-Type': 'text/plain',
                                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                            });
                            response.end("Cannot GET " + path);
                            return;
                        }
                    }
                }
                if (ModulePath.extname(realpath) === ".ejs") {
					let isLogin = false;
					await NaverLogin.isLogined(cookie.get("access_token")).then(data => { isLogin = data; });
					if (typeof isLogin !== "boolean") {
						isLogin = false;
					}
                    var data = ejs.render(
                        await util.promisify(fs.readFile)(realpath, "utf8"),
                        {
                            servers: (await api.handleHTMLRequest(undefined, undefined, "/api/getOnlineServers/", true)).result,
                            ejs: ejs,
                            fs: fs,
                            request: request,
							isLogin: isLogin,
                            token: cookie.get("access_token")
                        }
                    );
                }

                var ext = "text/plain";
                response.writeHead(200, {
                    'Content-Type': ((ext = mime.lookup(ModulePath.extname(realpath))) === false ? 'text/plain' : ext),
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                });
                let content = data || (["text/html", "application/javascript", "text/css"].includes(ext) ? await util.promisify(fs.readFile)(realpath, 'utf8') : await util.promisify(fs.readFile)(realpath));
                response.end(getBeautifier(ext, content));
            }
        } else {
            if (path.indexOf("/api/") === 0) {
                api.handleHTMLRequest(request, response);
            } else {
                response.writeHead(404, {
                    'Content-Type': 'text/plain',
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                });
                response.end("Cannot GET " + path);
            }
        }
    } while (false);
}

async function handleHTTP(request, response) {
    response.writeHead(301, {
        'Location': 'https://' + request.headers.host + request.url,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    response.end();
}

function getProtocol(request) {
    return request.socket instanceof TLSSocket ? "https" : "http";
}

http.createServer(function (request, response) {
    handleHTTP(request, response)
        .catch(() => {
            response.writeHead(500, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            });
            response.end("Internal server error");
        });
}).listen(80, function () {
    console.log("Server running on port 80.");
});

https.createServer(options, function (request, response) {
    handleRequest(request, response)
        .catch((e) => {
            response.writeHead(500, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            });
            response.end("Internal server error");
            console.debug(e)
        });
}).listen(port = 443, function () {
    console.log("Server running on port " + port + ".");
});

https.createServer(options, function (request, response) {
    PlusFriend.handleRequest(request, response);
}).listen(9021, function () {
    console.log("PlusFriend api server running on port 9021.");
});