'use strict';
(function (angular)
{
    var app = angular.module('game.host');

    // gamemmodes mock service - we always know the script for a packaged app...
    app.service('gameModes', ['$q', function ($q)
    {
        this.get = function gamesModesGetFn()
        {
            return $q.when({
                canvas: {
                    url: 'game.canvas.js'
                }
            });
        };
    }]);
})(window.angular);
