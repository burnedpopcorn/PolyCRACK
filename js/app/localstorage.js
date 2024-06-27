'use strict';
(function (angular, _)
{
    var module = angular.module('game.host');

    // For local people
    module.service('localStorage', ['$q', '$rootScope', 'chrome', function ($q, $rootScope, chrome)
    {
        this.initialise = function ()
        {
            var that = this;
            var initialised = $q.defer();
            chrome.storage.local.get(null, function (data)
            {
                $rootScope.safeApply(function ()
                {
                    delete data.initialise;
                    _.extend(that, data);
                    initialised.resolve();
                    $rootScope.$watch(function ()
                    {
                        return that;
                    }, function ()
                    {
                        chrome.storage.local.set(that);
                    }, true);
                });
            });

            return initialised.promise;
        };
    }]);
})(window.angular, window._);
