const uuid = require('uuid-random');
const querystring = require('querystring');
const Cookies = require("cookies");
const https = require("https");

const host = "nid.naver.com";
const token_url_path = "/oauth2.0/token";

function NaverLogin() {
    this.handleRequest = handleRequest;
    this.getToken = getToken;
    this.refreshToken = refreshToken;
    this.isLogined = isLogined;
}

const handleRequest = async (request, response) => {
    let url = request.url.split("?")[0];
    let ip = (request.headers['x-forwarded-for'] || '').split(',').pop() ||
        request.connection.remoteAddress ||
        request.socket.remoteAddress ||
        request.connection.socket.remoteAddress;

    ip = ip.replaceAll("::ffff:", "");

    let cookie = new Cookies(request, response);

    let state_key = '';

    if (__state.hasOwnProperty(ip)) {
        state_key = __state[ip];
    } else {
        __state[ip] = state_key = uuid();
    }

    if (!uuid.test(state_key)) {
        __state[ip] = state_key = uuid();
    }

    if (url === "/login" || url === "/login/") {
        let refresh_token_cookie = cookie.get('refresh_token');
        let accessToken = '';
        cookie.set('access_token', '', {maxAge: Date.now()});
        if (refresh_token_cookie !== '' && typeof refresh_token_cookie === "string") {
            await refreshToken(refresh_token_cookie).then(datum => {
                if (datum.token !== '') {
                    accessToken = datum.token;
                    cookie.set('access_token', datum.token, {
                        expires: new Date(Date.now() + (3600 * 1000))
                    });
                }
            }).catch(e => {
                accessToken = '';
            });
        }

        if (accessToken === '') {
            response.writeHead(301, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Location': 'https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=' + __client_id +
                    "&redirect_uri=" + querystring.escape("https://nlog.cf/login/callback") + "&state=" + querystring.escape(state_key)
            });
        } else {
            response.writeHead(301, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Location': 'https://' + request.headers.host + '/'
            });
        }

        response.end();
    } else {
        if (url === "/login/callback" || url === "/login/callback/") {
			try{
			let param = request.url.split("?");
            param.shift();
			param = querystring.parse(querystring.unescape(param.join("?")));
            await getToken(param['code'], param['state']).then(datum => {
                cookie.set('access_token', datum.token, {
                    expires: new Date(Date.now() + (60 * 60 * 1000)) //1시간: 3600 * 1s
                });
                cookie.set('refresh_token', datum.refresh_token, {
                    expires: new Date(Date.now() + (60 * 60 * 1000 * 24)) //1일
                });
                response.writeHead(301, {
                    'Content-Type': 'text/plain',
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                    'Location': 'https://' + request.headers.host + '/'
                });
                response.end();
            }).catch(e => {
                response.writeHead(200, {
                    'Content-Type': 'text/html',
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                });
                response.end("<!DOCTYPE html> <html lang=\"ko\"> <head><meta charset='UTF-8'><script>alert('로그인에 실패하였습니다.'); location.replace('https://' + location.host + '/')</script></head>");
            });
			}catch (e) {
				//console.log(e);
			}
            
        } else { //404
            response.writeHead(404, {
                'Content-Type': 'text/plain',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            });
            response.end("Cannot GET " + url);
        }
    }
};

const getToken = async (authorization_code, state) => {
    return new Promise((resolve, reject) => {
        let postdata = querystring.stringify({
            grant_type: "authorization_code",
            client_id: __client_id,
            client_secret: __client_secret,
            code: authorization_code,
            state: querystring.escape(state)
        });

        let response = '';

        /*let req = https.request({
            hostname: host,
            port: 443,
            path: token_url_path,
            method: "POST",
            headers: {
                'Content-Type': 'text/json;charset=utf-8',
                'Content-Length': Buffer.byteLength(postdata),
				'X-Naver-Client-Id': __client_id, 'X-Naver-Client-Secret': __client_secret
            }
        }, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });
            res.on("end", () => {
                if (response !== "") {
                    let data = JSON.parse(response);
						console.log(data);
                    if (
                        data.hasOwnProperty("access_token") &&
                        data.hasOwnProperty("token_type") &&
                        data.hasOwnProperty("expires_in")
                    ) {
                        resolve({token: data['access_token'], expires: data['expires_in']});
						return;
                    }
                }
                reject();
            })
        });console.log(postdata);*/
		
		let req = https.get("https://nid.naver.com/oauth2.0/token?" + postdata, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });
            res.on("end", () => {
                if (response !== "") {
                    let data = JSON.parse(response);
                    if (
                        data.hasOwnProperty("access_token") &&
                        data.hasOwnProperty("token_type")
                    ) {
                        resolve({token: data['access_token'], refresh_token: data['refresh_token'], expires: 3600});
						return;
                    }
                }
                reject();
            })
        });

        req.on("error", (e) => {
            reject(e)
        });

        //req.write(postdata);
        req.end();
    });
};

const refreshToken = async (refresh_token) => {
    return new Promise((resolve, reject) => {
        let postdata = querystring.stringify({
            grant_type: "refresh_token",
            client_id: __client_id,
            client_secret: __client_secret,
            refresh_token: refresh_token
        });

        let response = '';
		
		let req = https.get("https://nid.naver.com/oauth2.0/token?" + postdata, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });
            res.on("end", () => {
                if (response !== "") {
                    let data = JSON.parse(response);
                    if (
                        data.hasOwnProperty("access_token") &&
                        data.hasOwnProperty("token_type") &&
                        data.hasOwnProperty("expires_in")
                    ) {
                        resolve({
                            token: data['access_token'],
                            expires: data['expires_in'],
                            refresh_token: data['refresh_token']
                        });
                    }
                    return;
                }
                reject();
            })
        });

        /*let req = https.request({
            hostname: host,
            port: 443,
            path: token_url_path,
            method: "POST",
            headers: {
                'Content-Type': 'text/json;charset=utf-8',
                'Content-Length': Buffer.byteLength(postdata)
            }
        }, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });
            res.on("end", () => {
                if (response !== "") {
                    let data = JSON.parse(response);
                    if (
                        data.hasOwnProperty("access_token") &&
                        data.hasOwnProperty("token_type") &&
                        data.hasOwnProperty("expires_in")
                    ) {
                        resolve({
                            token: data['access_token'],
                            expires: data['expires_in'],
                            refresh_token: data['refresh_token']
                        });
                    }
                    return;
                }
                reject();
            })
        });*/

        req.on("error", (e) => {
            reject(e)
        });

        // req.write(postdata);
        req.end();
    });
};

const isLogined = (access_token) => {
    return new Promise((resolve, reject) => {
		if (access_token === "" || access_token === undefined) {
			resolve(false);
		}
        let response = '';

        let req = https.get({
            hostname: "openapi.naver.com",
            port: 443,
            path: "/v1/nid/me",
            headers: {
                'Content-Type': 'text/json;charset=utf-8',
                'Authorization': 'Bearer ' + access_token
            }
        }, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });
            res.on("end", () => {
                if (response !== "") {
                    if (res.statusCode === 200) {
                        resolve(true);
                    }
                    return;
                }
                resolve(false);
            });
        });

        req.on("error", (e) => {
            resolve(false)
        });

        req.end();
    });
};

module.exports = new NaverLogin();