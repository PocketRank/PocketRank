const http = require("http");
const fs = require("fs");
const util = require("util");
const dns = require("dns");

const html_root = "./public/";

function ApiHandler() {
    this.handleHTMLRequest = handleHTMLRequest;
}

async function handleHTMLRequest(request, response, path = "/", content = false) {
    path = ((request !== undefined) ? request.url : path).split("?")[0].substr("/api/".length);

    var used = false;
    var code = 404;
    var reason = {'Content-Type': 'text/plain; charset=utf8'};
    var data = {
        success: false,
        error: 'Request url "' + ((request !== undefined) ? request.url.split("?")[0] : path) + '" doesn\'t exist'
    };
    do {
        if (!used && path.indexOf("getServer/") === 0) {
            used = true;
            let addr = path.substr("getServer/".length);
            if (addr.split(":").length <= 2 && addr.split(":")[0] !== "") {
                try {
                    let ip = (await util.promisify(dns.lookup)(addr.split(":")[0])).address;
                    let port = parseInt(addr.split(":")[1] || 19132) || 19132;

                    let find = false;
                    for (var server of __query.servers) {
                        if (server.data.ip === ip && server.port === port) {
                            find = true;
                            break;
                        }
                    }
                    if (!find) {
                        data.error = "Server Not Found";
                        break;
                    }

                    try {
                        data.result = JSON.parse(await util.promisify(fs.readFile)(server.getDataPath()));
                    } catch (e) {
                        data.error = "Internal Server Error";
                        delete data.result;
                        break;
                    }
                    code = 200;
                    data.success = true;
                    delete data.error;
                } catch (e) {
                    data.error = "Invalid address";
                }
            } else {
                data.error = "You must request url such as 'address' or 'address:port'.";
            }
        }
        if (!used && (path.indexOf("getOnlineServers/") === 0 || path.indexOf("getOnlineServers") === 0)) {
            used = true;
            code = 200;
            let db = [];
            for (let server of __query.servers) {
                try {
                    if (server.data.online) {
                        db.push(JSON.parse(await util.promisify(fs.readFile)(server.getDataPath())));
                    }
                } catch (e) {
                }
            }
            data.success = true;
            data.result = db;
            delete data.error;
        }
        if (!used && (path.indexOf("getOfflineServers/") === 0 || path === "getOfflineServers")) {
            used = true;
            code = 200;
            let db = [];
            for (let server of __query.servers) {
                try {
                    if (!server.data.online) {
                        db.push(JSON.parse(await util.promisify(fs.readFile)(server.getDataPath())));
                    }
                } catch (e) {
                }
            }
            data.success = true;
            data.result = db;
            delete data.error;
        }
        if (!used && path.indexOf("getPlayerCounts/") === 0) {
            used = true;
            let addr = path.substr("getPlayerCounts/".length);
            if (addr === "total") {
                try {
                    data.result = await util.promisify(fs.readFile)(__csv_total_data, 'utf8');
                } catch (e) {
                    data.error = "Internal Server Error";
                    delete data.result;
                    break;
                }
                data.success = true;
                code = 200;
                delete data.error;
                break;
            }
            if (addr.split(":").length <= 2 && addr.split(":")[0] !== "") {
                try {
                    let ip = (await util.promisify(dns.lookup)(addr.split(":")[0])).address;
                    let port = parseInt(addr.split(":")[1] || 19132) || 19132;
                    let find = false;
                    for (var server of __query.servers) {
                        if (server.data.ip === ip && server.port === port) {
                            find = true;
                            break;
                        }
                    }

                    if (!find) {
                        data.error = "Server Not Found";
                        break;
                    }

                    try {
                        data.result = await util.promisify(fs.readFile)(server.getCSVPath(), 'utf8');
                    } catch (e) {
                        data.error = "Internal Server Error";
                        delete data.result;
                        break;
                    }
                    data.success = true;
                    code = 200;
                    delete data.error;
                } catch (e) {
                    data.error = "Invalid address";
                }
            } else {
                data.error = "You must request url such as 'address' or 'address:port'.";
            }
        }

        if (!used && (path.indexOf("getRankTXT/") === 0 || path === "getRankTXT")) {
            used = true;
            code = 200;
            let msg = "Rank data from pmmp.me\n";
            let i = 0;
            for (let server of __query.servers) {
                server = server.data;
                try {
                    if (i < 10) {
                        msg += ++i + "위 > " + server.host + (server.port !== 19132 ? ":" + server.port : "") + ", 접속자 : " + server.player_count + "\n";
                    }else{
                        break;
                    }
                } catch (e) {
                }
            }
            data.success = true;
            data.result = msg;
            delete data.error;
        }
    } while (false);

    if (content) {
        return data;
    }
    response.writeHead(code, reason);
    response.end(JSON.stringify(data, null, 4));
}

module.exports = new ApiHandler();