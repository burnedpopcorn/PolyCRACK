'use strict';
(function (angular/*, _*/)
{
    var app = angular.module('gamesite.services');

    app.service('config', ['$http', '$q', function ($http, $q)
    {
        var config = {};
        var deferred;

        this.get = function () {
            if (!deferred)
            {
                deferred = $q.defer();

                $http.get('/dynamic/config').then(function (response)
                {
                    var data = response.data;
                    if (data && data.ok)
                    {
                        angular.forEach(data.config, function (item)
                        {
                            config[item.key] = item;
                        });
                        deferred.resolve(config);
                    }
                    else
                    {
                        deferred.reject();
                    }

                }, function ()
                {
                    deferred.reject();
                });
            }

            return deferred.promise;
        };

        this.config = config;

    }]);

})(window.angular, window._);