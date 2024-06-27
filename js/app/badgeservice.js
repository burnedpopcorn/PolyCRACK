'use strict';
(function (angular, _)
{
    var app = angular.module('engine.services');

    app.service('badgeService', ['$http', 'online', 'bridgeServices', 'slug', 'chrome',
                                 function ($http, online, bridgeServices, slug, chrome)
    {
        this.add = function (data, callback)
        {
            var key = data.data.badge_key;
            var new_value = data.data.current || 0;
            var old_value = bridgeServices.getBadge(key) || 0;
            bridgeServices.setBadge(key, new_value);

            $http({method: 'get', url: '/api/v1/badges/read/' + slug, fromCache: true}).then(function (response)
            {
                var badgeTemplate = _.where(response.data.data, {key: key})[0];
                var total = badgeTemplate.total || 1;
                var current = new_value || total;
                var achieved = (old_value < total) && (current >= total);

                if (achieved)
                {
                    var notification = {
                        type : "basic",
                        title: badgeTemplate.title,
                        message: badgeTemplate.description,
                        iconUrl: chrome.runtime.getURL(badgeTemplate.imageresource.icon)
                    };
                    chrome.notifications.create('badge_' + badgeTemplate.key, notification, function () {});
                }

                if (!online.test())
                {
                    callback({
                        data: {
                            achieved: achieved,
                            badge_key: key,
                            current: current,
                            total: total
                        },
                        status: 200
                    });
                }
            });
        };

        this.read = function (data, callback)
        {
            if (!online.test())
            {
                $http.get('/api/v1/badges/read/' + slug).then(function (response)
                {
                    var retVal = [];

                    _.forEach(response.data.data, function (badgeTemplate)
                    {
                        var key = badgeTemplate.key;
                        var value = bridgeServices.getBadge(key);
                        if (!_.isUndefined(value))
                        {
                            var total = badgeTemplate.total || 1;
                            var current = value || total;
                            var achieved = current >= total;

                            retVal.push({
                                achieved: achieved,
                                badge_key: key,
                                current: current,
                                total: total
                            });
                        }
                    });

                    callback({
                        data: retVal,
                        status: 200
                    });
                });
            }
        };
    }]);

    app.run(['badgeService', 'bridgeServices', function (badgeService, bridgeServices)
    {
        bridgeServices.registerService('badge.add', badgeService.add, badgeService);
        bridgeServices.registerService('badge.read', badgeService.read, badgeService);
    }]);

})(window.angular, window._);

