'use strict';
(function (angular)
{
    var app = angular.module('game.host');

    app.service('online', ['$window', '$rootScope', 'utilities',
                           function ($window, $rootScope, utilities)
    {
        var forcedOffline = false;
        var that = this;
        this.onlineCallback = utilities.delegate();
        this.offlineCallback = utilities.delegate();

        $window.addEventListener("offline", function ()
        {
            $rootScope.safeApply(function ()
            {
                that.offlineCallback();
            });
        });

        $window.addEventListener("online", function ()
        {
            $rootScope.safeApply(function ()
            {
                that.onlineCallback();
            });
        });

        this.registerOnlineCallback = function (callback)
        {
            this.onlineCallback.add(callback);
        };

        this.removeOnlineCallback = function (callback)
        {
            this.onlineCallback.remove(callback);
        };

        this.registerOfflineCallback = function (callback)
        {
            this.offlineCallback.add(callback);
        };

        this.test = function ()
        {
            if (forcedOffline)
            {
                return false;
            }
            else
            {
                return $window.navigator.onLine;
            }
        };

        this.forceOffline = function ()
        {
            forcedOffline = true;
        };

        this.cancelForceOffline = function ()
        {
            forcedOffline = false;
        };
    }]);
})(window.angular);
