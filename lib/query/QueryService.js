const fs = require("fs");
const scheduler = require("node-schedule");
const Server = require(__app + "/lib/query/Server");
const util = require("util");

const echo = function (message) {
    console.log((new Date()).toLocaleString() + " " + message);
};

const existsFile = async function (path) {
    try {
        await util.promisify(fs.access)(path);
    } catch (e) {
        return false;
    }
    return true;
};

class QueryService {

    static getServers() {
        return __app + "/setting/servers.json";
    }

    static getTimeStamp() {
        return Math.floor(new Date().valueOf() * 0.001 / 60);
    }

    static async writeCSVFile(path, count) {
        let limit = 60 * 24 * 7;

        let data = [];
        if (await existsFile(path)) {
            data = (await util.promisify(fs.readFile)(path, 'utf8')).split("\n");
            data.shift();
        }

        while (limit <= data.length) {
            data.shift();
        }

        data.push(this.getTimeStamp() + "," + count);

        await util.promisify(fs.writeFile)(path, "time,numplayers\n" + data.join("\n"));
    }

    constructor() {
        this.servers = [];
    }

    async start() {
        if (!(await existsFile(__data))) {
            fs.mkdirSync(__data);
        }
        if (!(await existsFile(__csv_data))) {
            fs.mkdirSync(__csv_data);
        }
        await this.init().catch(e => {
            echo("[QueryService] 초기 작업 중 오류가 발생했습니다. 오류 로그: ");
            console.debug(e);
        });
        var that = this;
        scheduler.scheduleJob("* * * * *", function () {
            that.run().catch(err => {
                echo("[QueryService] 오류가 발생하였습니다. 오류 로그: ");
                console.debug(err);
            });
        });
    }

    async init() {
        var servers_path = QueryService.getServers();
        if (!await existsFile(servers_path)) {
            await util.promisify(fs.writeFile)(servers_path, JSON.stringify({}));
        }

        /**
         * ["domain:port", ... ]
         */
        var addresses = {};
        try {
            addresses = JSON.parse(await util.promisify(fs.readFile)(servers_path));
        } catch (e) {
            echo('[QueryService] "' + servers_path + "\" 파일을 읽을 수 없습니다. 오류 로그: ");
            console.debug(e);
        }

        for (let addr of Object.values(addresses)) {
            if (
                addr.hasOwnProperty('host') &&
                addr.hasOwnProperty('port') &&
                addr.hasOwnProperty('motd')
            ) {
                let server = new Server(addr.host, addr.port);
                await server.init(addr.motd);
                this.servers.push(server);
            }
        }

        this.servers.sort((a, b) => b.data.player_count - a.data.player_count);
    }

    async run() {
        for (let server of this.servers) {
            try{
                await server.receiveData();
            }catch (e) {
                echo("[QueryService] 서버 '" + server.host + ":" + server.port + "' 데이터 수집 중 오류가 발생했습니다.");
                console.debug(e);
            }
        }

        this.servers.sort((a, b) => b.data.player_count - a.data.player_count);
       // console.log(this.servers)
        let rank = 0, playing = 0;
        for (let server of this.servers) {
            try{
                if (server.data.online) {
                    server.setRank(++rank);
                    playing += server.data.player_count;
                    //console.log(rank);
                }else{
                    server.setRank(-1);
                }

                await server.saveData();
                await QueryService.writeCSVFile(server.getCSVPath(), server.data.player_count);
            }catch (e) {
                echo("[QueryService] 서버 '" + server.host + ":" + server.port + "' 데이터 저장/기록 중 오류가 발생했습니다.");
                console.debug(e);
            }
        }

        await QueryService.writeCSVFile(__csv_total_data, playing);
    }
}

module.exports = QueryService;