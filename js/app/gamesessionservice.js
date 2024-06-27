'use strict';
(function (angular)
{
    var module = angular.module('engine.services');
    module.service('gameSessionService', ['$http', 'bridge', 'online', 'sync', 'slug', function ($http, bridge, online, sync, slug)
    {
        var dummySessionId = "000000000000000000000000";

        this.createSession = function (data, callback)
        {
            var returnSession = function (gameSession)
            {
                callback({
                    gameSessionId: gameSession,
                    mappingTable: {
                        mappingTablePrefix: "/staticmax/",
                        mappingTableURL: "mapping_table.json",
                        assetPrefix: "/missing/"
                    },
                    ok: true,
                    status: 200
                });
            };

            if (online.test())
            {
                $http.post('/api/v1/games/create-session/' + slug + '/canvas').then(function (response)
                {
                    sync.setGameSession(response.data.gameSessionId);
                    returnSession(response.data.gameSessionId);
                });
            }
            else
            {
                returnSession(dummySessionId);
            }
        };
        this.destroySession = function (data, callback)
        {
            var gameSessionId = data.data.gameSessionId;
            sync.clearGameSession();
            if (online.test() && gameSessionId !== dummySessionId)
            {
                $http.post('/api/v1/games/destroy-session', {
                    gameSessionId: gameSessionId
                });
            }
            callback();
        };
    }]);

    module.run(['gameSessionService', 'bridgeServices', function (gameSessionService, bridgeServices)
    {
        bridgeServices.registerService('gamesession.create', gameSessionService.createSession, gameSessionService);
        bridgeServices.registerService('gamesession.destroy', gameSessionService.destroySession, gameSessionService);
    }]);
})(window.angular);
