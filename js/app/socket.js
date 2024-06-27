'use strict';
(function (angular, _)
{

    // Handles low level socket manipulation - creation destruction and re-connection
    var app = angular.module('gamesite.services');


    app.service('socket', ['$rootScope', '$q', '$timeout', 'io', 'config',
                           function ($rootScope, $q, $timeout, io, config)
    {
        var that = this;
        var loggedIn = false;
        var invalidateSocket = false;
        var reconnectTimeout;
        var reconnectDeferred;
        var socketDeferred = $q.defer();
        var callback_map = {};

        var reconnect = function (url)
        {
            that.close();
            reconnectTimeout = $timeout(function ()
            {
                var oldReconnectDeferred = reconnectDeferred;
                reconnectDeferred = null;
                oldReconnectDeferred.resolve(openSocket(url));
            }, 5000);
        };

        var openSocket = function (url)
        {
            var socket = io.connect(url + '/a', {
                'force new connection': true,
                'reconnection delay': 3000,
                'max reconnection attempts': Infinity
            });

            socket.__on = socket.on;
            socket.on = function (type, callback)
            {
                if (callback)
                {
                    if (!callback_map[type])
                    {
                        callback_map[type] = [];
                    }

                    var wrappedCallback = function ()
                    {
                        var args = arguments;
                        var thisArg = this;
                        $rootScope.safeApply(function ()
                        {
                            callback.apply(thisArg, args);
                        });
                    };

                    callback_map[type].push([callback, wrappedCallback]);
                    this.__on(type, wrappedCallback);
                }
            };

            socket.off = function (type, callback)
            {
                if (callback)
                {
                    var callback_list = callback_map[type];
                    if (callback_list)
                    {
                        var pos = _.findIndex(callback_list, function (pair)
                        {
                            return pair[0] === callback;
                        });
                        if (pos >= 0)
                        {
                            var wrappedCallback = callback_list[pos][1];
                            callback_list.splice(pos, 1);
                            this.removeListener(type, wrappedCallback);
                        }
                    }
                }
            };

            socket.on('connect', function ()
            {
                socket.emit('login');
                loggedIn = true;
            });

            //System event
            socket.on('disconnect', function (/*reason*/)
            {
                if (invalidateSocket)
                {
                    reconnect(url);
                    invalidateSocket = false;
                }
            });

            socket.on('force_reconnect', function ()
            {
                invalidateSocket = true;
            });

            socket.on('beforeunload', function ()
            {
                that.close();
            });

            socket.on('error', function ()
            {
                // Connection errors show up as errors before we have logged in. This will keep trying until we connect.
                if (!loggedIn)
                {
                    reconnect(url);
                }
            });

            socketDeferred.resolve(socket);
            return socket;
        };

        this.close = function ()
        {
            $timeout.cancel(reconnectTimeout);

            socketDeferred.promise.then(function (socket)
            {
                if (loggedIn)
                {
                    socket.emit('logout');
                }
                loggedIn = false;
                socket.removeAllListeners();
                socket.socket.disconnect();
            });
            socketDeferred = $q.defer();
        };

        this.open = function ()
        {
            return config.get().then(function (config)
            {
                return openSocket(config.msgserver.gadotmeurl);
            });
        };


        this.ifReconnect = function ()
        {
            if (!reconnectDeferred)
            {
                reconnectDeferred = $q.defer();
            }
            return reconnectDeferred.promise;
        };

        this.get = function ()
        {
            return socketDeferred.promise;
        };
    }]);

})(window.angular, window._);

