'use strict';
(function (angular, _)
{
    var app = angular.module('engine.services');

    app.service('leaderboardService', ['online', 'bridgeServices',
                                 function (online, bridgeServices)
    {
        this.add = function (data, callback)
        {
            if (!online.test())
            {
                var key = /\/([^\/]*)$/.exec(data.url)[1];
                data.__leaderboardKey = key;
                var events = bridgeServices.getEvents();
                var oldScoreLocation = _.findIndex(events, {__leaderboardKey: key});
                if (oldScoreLocation !== -1)
                {
                    events[oldScoreLocation] = data;
                }
                else
                {
                    events.push(data);
                }
                callback({
                    data: [],
                    status: 200
                });
            }
        };

    }]);

    app.run(['leaderboardService', 'bridgeServices', function (leaderboardService, bridgeServices)
    {
        bridgeServices.registerService('leaderboard.set', leaderboardService.add, leaderboardService);
    }]);

})(window.angular, window._);

