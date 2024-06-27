'use strict';
(function (angular/*, _*/)
{

    var app = angular.module('game.host');

    app.service('less', ['$window', function ($window)
    {
        return $window.less;
    }]);

    app.service('io', ['$window', function ($window)
    {
        return $window.io;
    }]);


    app.service('chrome', ['$window', function ($window)
    {
        return $window.chrome;
    }]);

    app.service('google', ['$window', function ($window)
    {
        return $window.google;
    }]);


})(window.angular, window._);
