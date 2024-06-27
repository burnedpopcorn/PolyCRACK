'use strict';
(function (angular, _)
{
    var app = angular.module('gamesite.services');

    app.service('message', ['socket', function (socket)
    {
        var queue = [];
        var listeners = {};
        var live = false;

        var attachListeners = function (realSocket)
        {
            angular.forEach(listeners, function (listnerList, messageName)
            {
                angular.forEach(listnerList, function (listner)
                {
                    realSocket.on(messageName, listner);
                });
            });
        };

        var detachListeners = function (realSocket)
        {
            angular.forEach(listeners, function (listnerList, messageName)
            {
                angular.forEach(listnerList, function (listner)
                {
                    realSocket.off(messageName, listner);
                });
            });
        };

        var flushQueue = function (realSocket)
        {
            if (queue && queue.length)
            {
                angular.forEach(queue, function (message)
                {
                    // TODO: should probably store time messages are added and only send them if they were added less
                    // than 5 minutes ago (or some other short time out)
                    realSocket.emit(message.name, message.data);
                    message.callback();
                });
                queue = [];
            }
        };

        var initSocketConnection = function (realSocket)
        {
            realSocket.on('disconnect', function ()
            {
                live = false;
                detachListeners(realSocket);
            });

            realSocket.on('connect', function ()
            {
                live = true;
                attachListeners(realSocket);
                // Manually fire connect event
                angular.forEach(listeners.connect, function (listener)
                {
                    listener();
                });
                flushQueue(realSocket);
            });

            socket.ifReconnect().then(function (reconnectSocket) {
                initSocketConnection(reconnectSocket);
            });
        };

        this.emit = function (messageName, data, callback, onlyIfOnline)
        {
            var cbfn = callback || angular.noop;
            if (live)
            {
                socket.get().then(function (realSocket)
                {
                    realSocket.emit(messageName, data);
                    cbfn();
                });
            }
            else if (!onlyIfOnline)
            {
                queue.push({
                    name: messageName,
                    data: data,
                    callback: cbfn
                });
            }
        };

        this.resetQueue = function resetQueueFn()
        {
            queue = [];
        };

        this.on = function (messageName, callback)
        {
            if (!listeners[messageName])
            {
                listeners[messageName] = [];
            }

            listeners[messageName].push(callback);

            if (live)
            {
                socket.get().then(function (realSocket)
                {
                    realSocket.on(messageName, callback);
                });
            }

            return angular.bind(this, function ()
            {
                this.off(messageName, callback);
            });
        };

        this.off = function (messageName, callback)
        {
            var messageListeners = this.listeners[messageName];
            if (messageListeners)
            {
                this.listeners[messageName] = _.without(messageListeners, callback);
                if (!this.listeners[messageName].length)
                {
                    delete this.listeners[messageName];
                }
            }

            if (live)
            {
                socket.get().then(function (realSocket)
                {
                    realSocket.off(messageName, callback);
                });
            }
        };

        socket.get().then(function (realSocket)
        {
            initSocketConnection(realSocket);
        });


    }]);
})(window.angular, window._);