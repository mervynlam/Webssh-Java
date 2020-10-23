function WSSHClient() {
};

WSSHClient.prototype._generateEndpoint = function () {
    if (window.location.protocol == 'https:') {
        var protocol = 'wss://';
    } else {
        var protocol = 'ws://';
    }
    // 内嵌应用可直接获取host
    // var host = window.location.host;
    // var endpoint = protocol+host+'/race/webssh';
    var endpoint = protocol+'127.0.0.1:8080/webssh';
    return endpoint;
};

WSSHClient.prototype.connect = function (options) {
    var endpoint = this._generateEndpoint();

    if (window.WebSocket) {
        //如果支持websocket
        this._connection = new WebSocket(endpoint);
    }else {
        //否则报错
        options.onError('WebSocket Not Supported');
        return;
    }

    this._connection.onopen = function () {
        options.onConnect();
        //开始连接，启动心跳检查
        // heartCheck.start();
    };

    this._connection.onmessage = function (evt) {
        var data = evt.data.toString();
        //如果是返回心跳，不执行onData();方法
        if (data !== "Heartbeat healthy") {
            options.onData(data);
        } else {
            //心跳健康，重置重连次数
            reconnectTimes = 0;
        }
        //收到消息，重置心跳检查
        heartCheck.start();
    };


    this._connection.onclose = function (evt) {
        options.onClose();
        reconnect(options);
    };
};

WSSHClient.prototype.send = function (data) {
    this._connection.send(JSON.stringify(data));
};

WSSHClient.prototype.sendInitData = function (options) {
    //连接参数
    this._connection.send(JSON.stringify(options));
}

//关闭连接
WSSHClient.prototype.close = function () {
    this._connection.close();
}

var client = new WSSHClient();

//心跳检查
var heartCheck = {
    checkTimeout: 5000,//心跳检查时间
    closeTimeout: 2000,//无心跳超时时间
    checkTimeoutObj: null,//心跳检查定时器
    closeTimeoutObj: null,//无心跳关闭定时器
    start: function () {
        //清除定时器
        clearTimeout(this.checkTimeoutObj);
        clearTimeout(this.closeTimeoutObj);

        // console.log("检查心跳");
        var _this = this;

        this.checkTimeoutObj = setTimeout(function () {
            client.send({operate: "heartbeat"});
            _this.closeTimeoutObj = setTimeout(function () {
                console.log("无心跳，关闭连接");
                client.close();
            }, _this.closeTimeout);
        }, this.checkTimeout);
    }
}

//重新连接
var lockReconnect = false;//重连锁，避免重复连接
var reconnectTimes = 0;
var maxReconnectTimes = 6;
function reconnect(options) {
    if (lockReconnect)
        return;

    // console.log("重新连接");

    //超过次数不重启
    if (reconnectTimes >= maxReconnectTimes) {
        options.onOverReconnect(reconnectTimes);
        return;
    }

    options.onReconnect(++reconnectTimes);

    setTimeout(function() {
        client.connect(options);
        lockReconnect = false;
    }, 500);
}