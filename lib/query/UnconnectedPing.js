const gamedig = require("gamedig");

function UnconnectedPing() {
    this.sendPing = sendPing;
}

const sendPing = (target, port = 19132) => {
    return gamedig.query({
        type: 'minecraftpeping',
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

module.exports = new UnconnectedPing();