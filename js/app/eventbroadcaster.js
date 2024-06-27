'use strict';
(function (angular, _)
{
    var app = angular.module('engine.services');

    app.service('eventbroadcaster', ['bridge', 'message', function (bridge, message)
    {

        var activeSessions = [];
        var activeMultiplayerSessions = [];

        message.on('connect', function ()
        {
            _.forEach(activeSessions, function (sessionId)
            {
                message.emit('msg', {
                    route: 'gamesessions',
                    event: 'reconnect',
                    data: {
                        gameSessionId: sessionId
                    }
                });
            });
        });

        bridge.on('game.session.created', function (event, sessionId)
        {
            message.emit('msg', {
                route: 'gamesessions',
                event: 'add',
                data: {
                    gameSessionId: sessionId
                }
            }, function ()
            {
                activeSessions.push(sessionId);
            });
        });

        bridge.on('game.session.status', function (event, sessionId, status)
        {
            var sessionStatus = status || '';
            message.emit('msg', {
                route: 'gamesessions',
                event: 'changeStatus',
                data: {
                    gameSessionId: sessionId,
                    status: sessionStatus
                }
            },
            angular.noop, true);
        });

        bridge.on('game.session.destroyed', function (event, sessionId)
        {
            activeSessions = _.without(activeSessions, sessionId);
            message.emit('msg', {
                route: 'gamesessions',
                event: 'remove',
                data: {
                    gameSessionId: sessionId
                }
            });
        });

        bridge.on('multiplayer.session.joined', function (event, session)
        {
            activeMultiplayerSessions.push(session.sessionId);
            message.emit('msg', {
                route: 'multiplayersessions',
                event: 'add',
                data: {
                    session: {
                        numPlayers: session.numPlayers,
                        playerId: session.playerId,
                        serverURL: session.serverURL,
                        sessionId: session.sessionId
                    }
                }
            });
        });

        bridge.on('multiplayer.session.leave', function (event, sessionId)
        {
            activeMultiplayerSessions = _.without(activeMultiplayerSessions, sessionId);
            message.emit('msg', {
                route: 'multiplayersessions',
                event: 'remove',
                data: {
                    sessionId: sessionId
                }
            });
        });

        bridge.on('multiplayer.session.makepublic', function (event, sessionId)
        {
            message.emit('msg', {
                route: 'multiplayersessions',
                event: 'makepublic',
                data: {
                    sessionId: sessionId
                }
            });
        });

        this.closeDanglingSessions = function ()
        {
            _.forEach(activeSessions, function (sessionId)
            {
                message.emit('msg', {
                    route: 'gamesessions',
                    event: 'remove',
                    data: {
                        gameSessionId: sessionId
                    }
                });
            });
            _.forEach(activeMultiplayerSessions, function (sessionId)
            {
                message.emit('msg', {
                    route: 'multiplayersessions',
                    event: 'remove',
                    data: {
                        gameSessionId: sessionId
                    }
                });
            });

            activeSessions = [];
            activeMultiplayerSessions = [];
        };
    }]);
})(window.angular, window._);

