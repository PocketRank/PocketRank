const util = require('util');
const fs = require('fs');
const dns = require('dns');

const query = require(__app + "/lib/query/Query");
const ping = require(__app + "/lib/query/UnconnectedPing");

class Server {

    static getMonday(d) {
        d = new Date(d);

        let day = d.getDay();
        let diff = d.getDate() - day + (day === 0 ? -6 : 1);

        d.setDate(diff);
        d.setHours(0, 0, 0, 0);

        return new Date(d);
    }

    static async schema(
        host,
        port,
        ip,
        online = false,
        motd = '',
        player_count = 0,
        max_player = 0,
        engine = 'Unknown',
        version = 'Unknown',
        players = {},
        plugins = {},
        daily = Server.periodRecord(),
        weekly = Server.periodRecord(Server.getMonday(Date.now())),
        total = Server.periodRecord(),
        lastOnline = -1
    ) {
        return {
            host: host,
            port: port || 19132,
            ip: await this.getIP(host),
            online: online,
            motd: motd,
            cleaned_motd: this.removeColorCode(motd),
            player_count: player_count,
            max_player: max_player,
            engine: engine,
            version: version,
            players: players || {},
            plugins: plugins || {},
            daily: daily,
            weekly: weekly,
            total: total,
            lastOnline: lastOnline
        };
    }

    async clean(content) {
        let sc = await Server.schema(this.host, this.port);

        for (let key in sc) {
            if (sc.hasOwnProperty(key) && Object.keys(content).includes(key) && typeof content[key] !== "undefined") {
                sc[key] = content[key];
            }
        }

        return sc;
    }

    static periodRecord(startTime = (new Date()).setHours(0, 0, 0, 0), high = 0, totalPing = 0, successPing = 0, successPercentage = 0) {
        return {
            start: startTime,
            high: totalPing,
            totalPing: totalPing,
            successPing: successPing,
            successPercentage: successPercentage
        };
    }

    static parsePlugins(plugins) {
        if (plugins.split(": ").length !== 2) {
            return [plugins];
        }
        return plugins.split(": ")[1].split("; ").map(fullname => {
            let split = fullname.split(" ");
            return {name: split.shift(), version: split.join(" ") || "Unknown"};
        });
    }

    static async existsFile(path) {
        try {
            await util.promisify(fs.access)(path);
        } catch (e) {
            return false;
        }
        return true;
    };

    static async getIP(host) {
        let ip = '';
        try {
            ip = (await util.promisify(dns.lookup)(host)).address;
        } catch (e) {
        }
        return ip;
    }

    static removeColorCode(str) {
        return str.replace(/\u00A7[0-9A-FK-OR]/gi, "");
    }

    constructor(host, port) {
        this.host = host;
        this.port = port || 19132;
    }

    async init(defaultMotd) {
        return new Promise(async (resolve) => {
            let data = '';
            let needDefault = true;
            if (Server.existsFile(this.getDataPath())) {
                try {
                    data = JSON.parse(await util.promisify(fs.readFile)(this.getDataPath(), 'utf8'));
                    if (data.hasOwnProperty('rank')) {
                        this.rank = data.rank;
                    }

                    data = await this.clean(data);
                    needDefault = false;
                } catch (e) {
                }
            }

            if (needDefault) {
                data = await Server.schema(this.host, this.port, '', false, '', 0, 0);

                data.motd = defaultMotd;
                data.cleaned_motd = Server.removeColorCode(data.motd);
            }


            resolve(this.data = data);
        });
    }

    getDataPath() {
        return __data + this.host + "_" + this.port + ".json";
    }

    getCSVPath() {
        return __csv_data + this.host + "_" + this.port + ".csv";
    }

    async receiveData() {
        let serverData = await this.clean(this.data);
        let newData = Object.assign(serverData, Server.schema(this.host, this.port));

        await ping.sendPing(this.host, this.port).then(data => {
            return new Promise((resolve, reject) => {
                if (!data) {
                    reject(0);
                } else {
                    newData = Object.assign(newData, {
                        online: true,
                        motd: data.name,
                        cleaned_motd: Server.removeColorCode(data.name),
                        player_count: parseInt(data.raw.numplayers),
                        max_player: parseInt(data.maxplayers),
                        engine: data.raw.server_engine,
                        version: data.raw.version
                    });
                    resolve(query.sendQuery(this.host, this.port))
                }
            })
        }).then(data => {
            if (data) {
                newData = Object.assign(newData, {
                    online: true,
                    motd: data.raw.hostname,
                    cleaned_motd: Server.removeColorCode(data.raw.hostname),
                    player_count: parseInt(data.raw.numplayers),
                    max_player: parseInt(data.raw.maxplayers),
                    engine: data.raw.server_engine,
                    version: data.raw.version,
                    players: data.players.map(datum => datum.name),
                    plugins: Server.parsePlugins(data.raw.plugins)
                });
            }
        }).catch(e => {
            if (e === 0) {
                newData = Object.assign(newData, {
                    online: false,
                    player_count: 0,
                    max_player: 0,
                    players: {},
                    plugins: {}
                });
                //server is offline
            } else {
                throw e;
            }
        });

        if (newData.online) {
            newData.lastOnline = Date.now();

            ++newData.daily.successPing;
            ++newData.weekly.successPing;
            ++newData.total.successPing;
        }
        ++newData.daily.totalPing;
        ++newData.weekly.totalPing;
        ++newData.total.totalPing;

        newData.daily.successPercentage = (newData.daily.successPing / newData.daily.totalPing) * 100;
        newData.weekly.successPercentage = (newData.weekly.successPing / newData.weekly.totalPing) * 100;
        newData.total.successPercentage = (newData.total.successPing / newData.total.totalPing) * 100;

        let count = newData.player_count;

        if (Server.getMonday(Date.now()).getTime() !== newData.weekly.start) { //next week
            newData.weekly.start = Server.getMonday(Date.now()).getTime();
            newData.weekly.high = 0;
        }

        if ((new Date()).setHours(0, 0, 0, 0) !== newData.daily.start) { // next day
            newData.daily.start = (new Date()).setHours(0, 0, 0, 0);
            newData.daily.high = 0;
        }

        newData.daily.high = Math.max(newData.daily.high, count);
        newData.weekly.high = Math.max(newData.weekly.high, count);
        newData.total.high = Math.max(newData.total.high, count);

        return this.data = newData;
    }

    setRank(rank) {
        if (rank > 0) {
            this.rank = rank;
        } else {
            if (this.hasOwnProperty('rank')) {
                delete this.rank;
            }
        }
    }

    async saveData() {
        this.data.rank = this.hasOwnProperty('rank') ? this.rank : -1;

        if (this.data.rank < 1) {
            delete this.data.rank;
        }

        await util.promisify(fs.writeFile)(this.getDataPath(), JSON.stringify(this.data, null, 4));
    }

}

module.exports = Server;