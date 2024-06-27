'use strict';
(function (angular, _)
{
    var app = angular.module('engine.services');

    app.service('bridgeServices',
        ['$http', 'bridge', 'localStorage', 'online',
        function ($http, bridge, localStorage, online)
    {
        var getData = function serviceManagerResetDataFn()
        {
            if (_.isEmpty(localStorage.data))
            {
                localStorage.data = {
                    events: [],
                    userData: {},
                    userDataKeyList: [],
                    badges: {},
                    badgeKeyList: []
                };
            }
            return localStorage.data;
        };

        this.registerService = function serviceManagerRegisterServiceFn(eventName, handler, context)
        {
            bridge.on('bridgeservices.' + eventName, function (event, jsonstring)
            {
                var request = JSON.parse(jsonstring);
                var callback = function () {};
                if (request.key)
                {
                    callback = function (data)
                    {
                        var response = {
                            data: data,
                            key: request.key
                        };
                        setTimeout(function () {
                            bridge.emit('bridgeservices.response', JSON.stringify(response));
                        }, 0);
                    };
                }
                handler.call(context, request.data, callback);
                event.retVal = JSON.stringify({fullyProcessed: !online.test() ||
                    eventName === "gamesession.create" ||  eventName === "gamesession.destroy"});
            });
        };

        this.captureEvent = function (response)
        {
            return function (data, callback)
            {
                getData().events.push(data);
                callback(response);
            };
        };

        this.getEvents = function ()
        {
            return getData().events;
        };

        this.setItem = function (key, value)
        {
            var keyList = getData().userDataKeyList;
            if (_.indexOf(keyList, key) === -1)
            {
                keyList.push(key);
            }
            getData().userData[key] = value;
        };

        this.getItemList = function ()
        {
            return getData().userDataKeyList;
        };

        this.getItem = function (key)
        {
            return getData().userData[key];
        };

        this.removeItem = function (key)
        {
            getData().userDataKeyList = _.without(localStorage.data.userDataKeyList, key);
            delete getData().userData[key];
        };

        this.removeAllItems = function ()
        {
            getData().userData =  {};
            getData().userDataKeyList = [];
        };

        this.setBadge = function (key, value)
        {
            var keyList = getData().badgeKeyList;
            if (_.indexOf(keyList, key) === -1)
            {
                keyList.push(key);
            }
            getData().badges[key] = value;
        };

        this.getBadgeList = function ()
        {
            return getData().badgeKeyList;
        };

        this.getBadge = function (key)
        {
            return getData().badges[key];
        };

        this.removeAllBadges = function ()
        {
            getData().badges =  {};
            getData().badgeKeyList = [];
        };

        this.getEventList = function ()
        {
            return getData().events;
        };

        this.removeAllEvents = function ()
        {
            getData().events = [];
        };

        this.startSyncing = function ()
        {
            this.syncing = true;
            bridge.emit('bridgeservices.sync.start');
        };

        this.endSyncing = function ()
        {
            this.syncing = false;
            bridge.emit('bridgeservices.sync.end');
        };

        this.getCachedResponse = function (data, callback)
        {
            if (!online.test())
            {
                $http(data).then(function (response)
                {
                    var retval = _.cloneDeep(response.data);
                    retval.status = response.status;
                    callback(retval);
                });
            }
        };

        this.respondifOffline = function (response)
        {
            return function (data, callback)
            {
                if (!online.test())
                {
                    callback(response);
                }
            };
        };

        online.registerOnlineCallback(function () {
            bridge.emit('bridgeservices.offline.end');
        });

        online.registerOfflineCallback(function () {
            bridge.emit('bridgeservices.offline.start');
        });

    }]);

    app.run(function (bridgeServices) {

        bridgeServices.registerService('badge.meta', bridgeServices.getCachedResponse);
        bridgeServices.registerService('leaderboard.meta', bridgeServices.getCachedResponse);
        bridgeServices.registerService('profile.user', bridgeServices.getCachedResponse);
        bridgeServices.registerService('notifications.keys', bridgeServices.getCachedResponse);
        bridgeServices.registerService('notifications.usersettings', bridgeServices.getCachedResponse);

        bridgeServices.registerService('custommetrics.addevent',  bridgeServices.respondifOffline({
            data: [],
            status: 200
        }));

        bridgeServices.registerService('custommetrics.addeventbatch', bridgeServices.respondifOffline({
            data: [],
            status: 200
        }));
    });

})(window.angular, window._);

