var http = require("http");
var fs = require("fs");
var dns = require("dns");

dns.lookup("h", (err, res) => {
    console.log(res)
})