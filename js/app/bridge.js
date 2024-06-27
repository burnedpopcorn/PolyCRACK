'use strict';
(function (angular, _)
{

    var app = angular.module('gamesite.services');

    app.service('bridge', ['$rootScope', '$window', function ($rootScope, $window) {

        // Initialise data bridge via Turbulenz object
        $window.Turbulenz = {
            Services: {},
            Data: {}
        };

        var eventEmitter = $rootScope.$new(true);
        var gameDeregisterFunctions = [];

        // Game-facing API
        $window.Turbulenz.Services.bridge = {
            // These functions will be called via another object so do not use 'this' in any methods!
            // addListener is a legacy function - move everything to use "on"
            setListener: function (event, callback)
            {
                gameDeregisterFunctions.push(eventEmitter.$on(event, function ()
                {
                    // Strip the event object from the arguments to the callback as the game is not expecting it
                    var args = Array.prototype.slice.call(arguments, 1);
                    callback.apply(this, args);
                }));
            },
            emit: function (eventName, eventData)
            {
                var event = {};
                var emitEvent = function ()
                {
                    event = eventEmitter.$emit(eventName, eventData);
                };
                $rootScope.safeApply(emitEvent);
                return event.retVal;
            }
        };

        // Site-facing API
        this.on = angular.bind(eventEmitter, eventEmitter.$on);

        this.emit = angular.bind(eventEmitter, eventEmitter.$emit);

        this.clearGameListeners = function ()
        {
            _.invoke(gameDeregisterFunctions, "call");
            gameDeregisterFunctions = [];
        };

        this.get = function ()
        {
            return $window.Turbulenz.Services.bridge;
        };
    }]);

})(window.angular, window._);
