'use strict';
(function (angular)
{
    var app = angular.module('engine.services');

    // Handles starting and stopping the game, talking to the tz engine
    app.service('gamePlayer', ['$window', '$timeout', '$q', 'bridge', 'eventbroadcaster', 'baseUrl', 'bridgeServices', 'online',
                               function ($window, $timeout, $q, bridge, eventbroadcaster, baseUrl, bridgeServices, online)
    {
        var that = this;
        $window.TurbulenzEngine = $window.TurbulenzEngine || {};

        this.playGame = function (slug, canvas)
        {
            $window.gameSlug = slug;
            $window.Turbulenz.Data.mode = 'canvas';
            var appEntry = $window.TurbulenzEngine.onload;
            var appShutdown = $window.TurbulenzEngine.onunload;
            if (!appEntry)
            {
                return;
            }

            $window.TurbulenzEngine = $window.WebGLTurbulenzEngine.create({
                canvas: canvas
            });

            if (!$window.TurbulenzEngine)
            {
                return;
            }

            $window.TurbulenzEngine.onload = appEntry;
            $window.TurbulenzEngine.onunload = appShutdown;
            appEntry();
            $timeout(function ()
            {
                canvas.webkitRequestFullscreen();
            }, 100);
        };

        this.stopGame = function ()
        {
            var stopped = $q.defer();
            // inverse of $apply...
            $window.setTimeout(function () {
                if ($window.TurbulenzEngine.unload)
                {
                    $window.TurbulenzEngine.unload();
                }
                bridge.clearGameListeners();
                $timeout(function () {
                    eventbroadcaster.closeDanglingSessions();
                }, 5000);
                delete $window.gameSlug;
                stopped.resolve();
            }, 0);
            return stopped.promise;
        };

        bridge.on('config.request', function ()
        {
            var configString = JSON.stringify({
                mode: 'canvas',
                joinMultiplayerSessionId: null,
                bridgeServices: true,
                servicesDomain: baseUrl,
                syncing: bridgeServices.syncing,
                offline: !online.test()
            });
            bridge.emit('config.set', configString);
        });

        $window.addEventListener('message', function (e)
        {
            if (e.data === 'TurbulenzEngine.onunload')
            {
                that.stopGame();
            }
        });
    }]);

    // Handles setting up and sizing the canvas play area
    app.directive('gameCanvas', ['$window', 'gameModes', 'gamePlayer',
                                 function ($window, gameModes, gamePlayer) {

        return {
            restrict: 'EA',
            scope: {
                gameState: '=game'
            },
            link: function ($scope, element)
            {
                $scope.$id += "-gameCanvas";
                // TODO: plugin support!

                // The generated canvas element
                var canvas = null;

                var resizePlayArea = function ()
                {
                    var gameState = $scope.gameState;
                    if (gameState && gameState.playing)
                    {
                        if (canvas)
                        {

                            // Caclulate available space to put game in
                            if (document.fullscreenEnabled || document.mozFullScreen || document.webkitIsFullScreen)
                            {
                                canvas.width = $window.innerWidth;
                                canvas.height = $window.innerHeight;
                            }
                            else
                            {
                                element.width(element.parent().width());
                                element.height(element.parent().height());
                                canvas.width = element.parent().width();
                                canvas.height = element.parent().height();
                            }
                        }
                    }
                    else
                    {
                        element.width(0);
                        element.height(0);
                    }
                };

                function startPlaying(gameState)
                {
                    var canvasScript = document.createElement('script');
                    element.html(
                        '<canvas id="turbulenz_game_engine_object" moz-opaque="true" tabindex="1"></canvas>');
                    canvas = element.find('canvas')[0];

                    gameModes.get(gameState.slug).then(function (gameModes)
                    {
                        // Dom manipulation required in order to get the events fired (otherwise jQuery attaches
                        // to the events after they have fired
                        canvasScript.type = 'text/javascript';
                        canvasScript.src = gameModes.canvas.url;
                        if (canvasScript.addEventListener)
                        {
                            canvasScript.addEventListener("load", function ()
                            {
                                gamePlayer.playGame(gameState.slug, canvas);
                            }, false);
                        }
                        else if (canvasScript.readyState)
                        {
                            canvasScript.onreadystatechange = function ()
                            {
                                if (this.readyState === "loaded" || this.readyState === "complete")
                                {
                                    gamePlayer.playGame(gameState.slug, canvas);
                                }
                            };
                        }
                        element[0].appendChild(canvasScript);
                    });
                }

                function stopPlaying()
                {
                    gamePlayer.stopGame().then(function ()
                    {
                        element.html('');
                        canvas = null;
                    });
                }

                $scope.$watch('gameState', function onPlayFn(gameState)
                {
                    if (gameState)
                    {
                        if (gameState.playing)
                        {
                            startPlaying(gameState);
                        }
                        else
                        {
                            stopPlaying();
                        }
                    }

                    resizePlayArea();
                }, true);

//                element.keyup(event, function (event)
//                {
//                    if (event.which === 81)
//                    {
//                        $scope.$apply(function ()
//                        {
//                            $scope.gameState.playing = false;
//                        });
//                    }
//                });

                // Update area when window resizes. Using scope means resize only happens once even if multiple resize
                // events are triggered so long as the actual window size does not change
                $scope.windowDimensions = {};
                var windowElement = angular.element($window);
                windowElement.bind('resize', function ()
                {
                    $scope.windowDimensions.width = windowElement.width();
                    $scope.windowDimensions.height = windowElement.height();
                    $scope.$apply('windowDimensions');
                });
                $scope.$watch('windowDimensions', resizePlayArea, true);
            }
        };

    }]);
})(window.angular);
