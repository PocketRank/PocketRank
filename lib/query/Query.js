const gamedig = require("gamedig");

function Query() {
    this.sendQuery = sendQuery;
}

const sendQuery = (target, port = 19132) => {
    return gamedig.query({
        type: 'minecraftpe',
        host: target,
        port: port,
        maxAttempts: 1,
        socketTimeout: 2000
    }).catch(function (error) {
        return new Promise(resolve => {
            resolve(false)
        });
    })
};

module.exports = new Query();