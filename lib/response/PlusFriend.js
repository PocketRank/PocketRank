const fs = require("fs");
const util = require("util");

const default_keyboard = {
    type: "buttons",
    buttons: [
        "/서버",
        "/순위",
        "/서버신청양식"
    ]
};

const lists = [];

class PlusFriend {

    static async handleRequest(request, response) {
        let code = 403;
        let reason = {'Content-Type': 'application/json; charset=utf8'};
        let data = {};

        do {
            if (request.url.indexOf("/keyboard") === 0 && request.method === "GET") {
                code = 200;
                data = default_keyboard;
            }

            if (request.url.indexOf("/message") === 0 && request.method === "POST") {
                let body = '';
                request.on('data', chunk => {
                    body += chunk.toString(); // convert Buffer to string
                });
                request.on('end', async () => {
                    body = JSON.parse(body);
                    if (lists.hasOwnProperty(body["user_key"]) && !body.content.startsWith("/")) {
                        if (lists[body["user_key"]].requestTime + (60 * 5 * 1000) >= Date.now()) {
                            if (lists[body["user_key"]].method === "detail") {
                                let message = "";
                                let apiResult = await api.handleHTMLRequest(undefined, undefined, "/api/getServer/" + 
									body.content.replaceAll("[온라인] ", "").replaceAll("[오프라인] ", ""), true);
                                if (apiResult.success) {
                                    let result = apiResult.result;
                                    message = "'" + result.host + (result.port === 19132 ? "" : ":" + result.port) + "' 에 대한 서버 정보입니다.\n";
                                    message += "서버가 현재 " + (result.online ? "온라인" : "오프라인") + " 상태" + (result.online ? "이며, " + result.rank + "등" : "") + "입니다.\n";
                                    message += "서버 이름 : " + result.cleaned_motd + "\n";
                                    message += "접속자 수 : " + result.player_count + "\n";
                                    message += "최대 접속자 수 : " + (result.total.high < 0 ? "'데이터 없음'" : result.total.high + "명") + "\n";
                                    message += "일간 최대 접속자 수 : " + (result.daily.high < 0 ? "'데이터 없음'" : result.daily.high + "명") + "\n";
                                    message += "서버 엔진 : " + (result.engine === "Unknown" ? "'알 수 없음'" : result.engine) + "\n";
                                    message += "서버 버전 : " + (result.version === "Unknown" ? "'알 수 없음'" : result.version) + "\n\n" +
                                        "자세한 정보를 보시려면 아래 버튼을 클릭하여 웹사이트에서 확인하세요";
                                } else {
                                    switch (apiResult.error) {
                                        case "You must request url such as 'address' or 'address:port'.":
                                            message = "서버주소를 제대로 입력해주세요.";
                                            break;
                                        case "Invalid address":
                                            message = "존재하지 않는 주소입니다.";
                                            break;
                                        case "Internal Server Error":
                                            message = "서버 내부 에러입니다.\n관리진에게 제보해주세요.";
                                            break;
                                        case "Server Not Found":
                                            message = "MCBE RANK 사이트에 등록되지 않은 사이트입니다.\n사이트에 등록 신청을 해주시기 바랍니다.";
                                            break;
                                        default:
                                            message = result.error;
                                            break;
                                    }
                                }

                                data = {
                                    message: {
                                        text: message,
                                        message_button: {
                                            label: "사이트에서 확인하기",
                                            url: "https://pmmp.me/"
                                        }
                                    },
                                    keyboard: default_keyboard
                                }

                            } // 서버 자세히 보기
                        } else {
                            data = {
                                message: {
                                    text: "요청 시간이 초과되었습니다.\n다시 시도해주세요"
                                },
                                keyboard: default_keyboard
                            }
                        }

                        delete lists[body['user_key']];

                        code = 200;

                        response.writeHead(code, reason);
                        response.end(JSON.stringify(data, null, 4));

                        return;
                    }

                    if (lists.hasOwnProperty(body['user_key'])) {
                        delete lists[body['user_key']];
                    }

                    switch (body.content) {
                        case "/서버신청양식":
                            code = 200;
                            data = {
                                message: {
                                    text: "아래 양식을 맞춰서 보내주세요.\n" +
                                        "상담원 모드에서 보내주세요.\n\n" +
                                        "서버이름 : \n" +
                                        "서버주소 : \n" +
                                        "포트 : \n" +
                                        "24시간 서버인가요? (네/아니요) : \n" +
                                        "서버가 현재 온라인 상태인가요? (네/아니오) : "
                                },
                                keyboard: default_keyboard
                            };
                            break;
                        case "/순위":
                            code = 200;
                            data = {
                                message: {
                                    text: (await api.handleHTMLRequest(undefined, undefined, "/api/getRankTXT/", true)).result,
                                    message_button: {
                                        label: "사이트에서 확인하기",
                                        url: "https://pmmp.me/"
                                    }
                                },
                                keyboard: default_keyboard
                            };
                            break;
                        case "/서버":
                            code = 200;
							let apiResult = Object.values((await api.handleHTMLRequest(undefined, undefined, "/api/getOnlineServers/", true)).result);
							for (let offlineServer of Object.values((await api.handleHTMLRequest(undefined, undefined, "/api/getOfflineServers/", true)).result)) {
								apiResult.push(offlineServer);
							}
								let servers = apiResult;
								data = {
								message: {
									text: "정보를 보고 싶은 서버 주소를 선택해주세요."
								},
								keyboard: {
									type: "buttons",
									buttons: Object.values(servers).map(server => "[" + (server.online ? "온라인" : "오프라인") + "] " + server.host + 
										(server.port === 19132 ? "" : ":" + server.port)
									)
								}
							};
							lists[body["user_key"]] = {method: "detail", requestTime: Date.now()};
                            break;
                        default:
                            code = 200;
                            data = {
                                message: {
                                    text: "문의할 내용은 상담원 모드에서 보내주세요."
                                },
                                keyboard: default_keyboard
                            };
                            break;
                    }
                    response.writeHead(code, reason);
                    response.end(JSON.stringify(data, null, 4));
                });

                return;
            }
        } while (false);

        response.writeHead(code, reason);
        response.end(JSON.stringify(data, null, 4));
    }

}

module.exports = PlusFriend;