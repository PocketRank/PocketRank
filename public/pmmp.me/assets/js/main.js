window.__lastData = undefined;
window.__lastChecked = true;

async function reloadData() {
    try {
        let server_status = (document.getElementById("online").checked);
        //let sort = document.getElementById("sort").value; //1: random, 2: rank
        if (typeof __lastData === 'undefined' || __lastChecked !== server_status) {
            await getServerData(server_status).then(data => {
                window.__lastData = data;
            });
        }

        window.__lastChecked = server_status;

        /*
        switch (sort) {
            case 1:
                break;
            case 2:
                break;
            default:
                //throw new DOMException();
        }
        */

        if (__lastData.success === true) {
            String.prototype.replaceAll = function (target, replacement) {
                return this.split(target).join(replacement);
            };
            var string =
                "<div class=\"server-card\">\n" +
                "<button type='button' class=\"collapsible server-card-header btn btn-outline-secondary \" style='display: block;' data-count='%player_count%' data-rank='%rank%'>\n" +
                "<span style='margin-bottom: -5px; display: inline-block; max-width: 73%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 5px;'>%cleaned_motd%</span>" +
                "<div style='max-width: 73%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 5px; font-size: 0.87em;'>%host%:%port%</div>" +
                "</button>\n" +
                "<div class=\"collapsible-content\">\n" +
                "<div class=\"server-card-body row\">\n" +
                "<div class=\"col-sm-6\">\n" +
                "<div>주소</div>\n" +
                "<div>%host%:%port%</div>\n" +
                "</div>\n" +
                "<div class=\"col-sm-6\">\n" +
                "<div>동접 / 일간최대</div>\n" +
                "<div>%player_count% / %daily_high%</div>\n" +
                "</div>\n" +
                "<div class=\"col-sm-6\">\n" +
                "<div>순위</div>\n" +
                "<div>%rank%등</div>\n" +
                "</div>\n" +
                "<div class=\"col-sm-6\">\n" +
                "<div>서버 업타임</div>\n" +
                "<div>%successPercentage%%</div>\n" +
                "</div>\n" +
                "</div>\n" +
                "<div class=\"server-card-footer\">ver: %version%, engine: %engine%</div>\n" +
                "</div>\n" +
                "</div>";
            if (!server_status) {
                string =
                    "<div class=\"server-card\">\n" +
                    "<button type='button' class=\"collapsible server-card-header btn btn-outline-secondary offline\" style='display: block;'>\n" +
                    "<span style='margin-bottom: -5px; display: inline-block; max-width: 73%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 5px;'>%cleaned_motd%</span>" +
                    "<div style='max-width: 73%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 5px; font-size: 0.87em;'>%host%:%port%</div>" +
                    "</button>\n" +
                    "<div class=\"collapsible-content\">\n" +
                    "<div class=\"server-card-body row\">\n" +
                    "<div class=\"col-sm-6\">\n" +
                    "<div>주소</div>\n" +
                    "<div>%host%:%port%</div>\n" +
                    "</div>\n" +
                    "<div class=\"col-sm-6\">\n" +
                    "<div>일간 최대 / 주간 최대</div>\n" +
                    "<div>%daily_high% / %weekly_high%</div>\n" +
                    "</div>\n" +
                    "<div class=\"col-sm-6\">\n" +
                    "<div>최대 동접</div>\n" +
                    "<div>%high%</div>\n" +
                    "</div>\n" +
                    "<div class=\"col-sm-6\">\n" +
                    "<div>서버 업타임</div>\n" +
                    "<div>%successPercentage%%</div>\n" +
                    "</div>\n" +
                    "</div>\n" +
                    "<div class=\"server-card-footer\">ver: %version%, engine: %engine%</div>\n" +
                    "</div>\n" +
                    "</div>";
            }
            let results = [];
            for (let data of Object.values(__lastData.result)) {
                try {
                    let result = string
                        .replaceAll("%high%", data.total.high)
                        .replaceAll("%daily_high%", data.daily.high)
                        .replaceAll("%weekly_high%", data.weekly.high)
                        .replaceAll("%rank%", data.rank)
                        .replaceAll("%successPercentage%", data.total.successPercentage.toFixed(1));

                    result = result.replace(new RegExp(Object.keys(data).map(function (str) {
                        return "%" + str + "%";
                    }).join("|"), "gi"), function (substring) {
                        return data[substring.replaceAll("%", "")];
                    });

                    results.push(result);
                } catch (e) {
                }
            }

            if (results.length < 1) {
                results = ["<h3>" + (server_status ? "온라인" : "오프라인") + "인 서버가 없습니다.</h3>"];
            }

            document.getElementById('servers').innerHTML = html_beautify(results.join("\n"));
            calcCollapsible();
        }else{
            alert("API가 정상적으로 작동하지 않습니다.");
            alert(__lastData.error);
        }

    } catch (e) {
        console.debug(e);
        alert("오류가 발생했습니다.");
    }
}

function refreshData() {
    getServerData((document.getElementById("online").checked)).then(() => reloadData());
}

function getServerData(status) {
    return Promise.race([new Promise((resolve, reject) => {

        //console.log(status)
        let method = status ? "Online" : "Offline";
        let url = location.protocol + "//" + location.host + "/api/get" + method + "Servers/";

        let request = new XMLHttpRequest();

        request.open('GET', url, true);
        request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    resolve(JSON.parse(request.responseText));
                } else {
                    reject();
                }
            }
        };
        request.send();
    }), new Promise(resolve => {
        const timeout = setTimeout(() => {
            clearTimeout(timeout);
            resolve(false);
        }, 2000); // 2s to timeout
    })]);
}