'use strict';
(function (angular, _) {

    var app = angular.module('game.host');

    // Keeps track of the opened modal-types (there can only ever be one of each kind)
    var modalStack = {

        stack: [],

        _reSortLayers: function () {
            _.each(this.stack, function (scope, index) {
                scope.stackIndex = index;
            });
        },
        remove: function (scope) {

            // remove all instances of 'scope' (there should only be one!) from the stack
            // and set everything to be in the stack
            _.remove(this.stack, function (obj) {
                obj.inStack = true;
                return obj.$id === scope.$id;
            });

        },
        push: function (scope) {

            // remove all instances of 'scope' (there should only be one!) from the stack,
            // push a new one on top and set it to not be in the stack (it's *on* the stack)
            this.remove(scope);
            this.stack.push(scope);
            scope.inStack = false;
            this._reSortLayers();

        },
        pop: function (scope) {

            // remove all instances of 'scope' (there should only be one!) from the stack
            // and set both the removed item and the top of the stack to not be 'inStack' any more
            this.remove(scope);
            scope.inStack = false;
            (_.last(this.stack) || {}).inStack = false;
            this._reSortLayers();

        }
    };

    /**
     * Use this service to register new types of modals. For example
     *
     * html:    <div tz-modal="showMe" on-before-close="optionalCloseCheck()"
     *               on-hide-finished="postCloseCleanup()" ng-controller="tzBlaController">blabla</div>
     *
     * js:      app.controller('tzBlaController', function ($scope, tzModals) {
     *
     *              tzModals.register('bla', $scope);          <-- register the modal
     *
     *              $scope.onShowModal = function (args) {};    <-- (optional) do stuff when the modal gets opened
     *
     *              $scope.optionalCloseCheck = function () {   <-- (optional) do stuff before the modal gets closed. Return true to actually close it
     *                  return {close: true/false};
     *              };
     *
     *              $scope.showMe = true/false;                 <-- open the modal or close it when you're done
     *
     *          };
     *
     *          app.controller('otherController', function (tzModals) {
     *
     *              tzModals.show('bla', args);                <-- use the modal (args get passed to onShowModal)
     *
     *          };
     */
    app.service('tzModals', function tzModalsServiceFn($q, $timeout) {

        var callbacks = {};

        // register new modal-types ..
        this.register = function (key, $scope) {

            callbacks[key] = function () {

                if ($scope.onShowModal)
                {
                    $scope.onShowModal.apply(this, arguments);
                }

                $timeout(function ()
                {
                    $scope.show = true;
                }, 0);
                return $scope;
            };

        };

        // .. and show them
        this.show = function (type) {

            var callback = callbacks[type];

            if (callback)
            {
                var deferred = $q.defer();

                // pass any arguments (except the 'type' of course, that's what _.rest is for)
                var scope = callback.apply(this, _.rest(arguments));
                scope.modalDeferred = deferred;

                return deferred.promise;
            }
            else
            {
                throw new Error('No modal of type ' + type + ' registered');
            }

        };

    });


    app.directive('tzModal', function ($q, $window, $timeout) {

        return {
            replace: true,
            template: '<div class="tz-anim modal-backdrop" ng-show="modalVisible" ' +
                           'ng-class="{\'in-stack\' : inStack}" ' +
                           'ng-click="show = false; stopPropagation($event)" ' +
                           'ng-style="{\'z-index\': zIndex + stackIndex}"' +
                           'tz-animation-finished="onEndAnim" >' +
                           '<div ng-click="stopPropagation($event); $event.stopPropagation()"' +
                                'class="modal game-color-scheme"></div>' +
                      '</div>',
            transclude: true,
            compile: function (element, attributes, transclude)
            {
                return function (scope, element) {

                    scope.onEndAnim = angular.noop;

                    var transcluded;

                    var closeModal = function ()
                    {
                        $q.when(scope.$eval(attributes.onBeforeClose) || {close: true}).then(function (result) {

                            var close = result.close;
                            if (close)
                            {
                                // 'modalVisible' determines whether the modal should be shown or not.
                                // The show/hide variable passed in via 'attributes.tzModal' is just an indicator of
                                // what the individual controller would LIKE to happen ..
                                scope.modalVisible = false;

                                // .. that's why we need to ensure it's synced with the outcome of the actual 'close' operation here ..
                                scope.$eval(attributes.tzModal + ' = false');
                                scope.onEndAnim = function ()
                                {
                                    scope.$eval(attributes.onHideFinished);
                                    scope.onEndAnim = angular.noop;
                                };
                                modalStack.pop(scope);  // make sure this modal is removed from the stack

                                if (result.success)
                                {
                                    scope.modalDeferred.resolve(result);
                                }
                                else
                                {
                                    scope.modalDeferred.reject(result);
                                }
                            }
                            else
                            {
                                // .. and here ..
                                scope.$eval(attributes.tzModal + ' = true');
                            }

                        },
                        function () {

                            // .. and here. Because if the customer would set 'attributes.tzModal' to 'false' but we don't
                            // actually close anything and *don't* force 'attributes.tzModal' back to 'true', the next time
                            // the customer tries to set it to 'false' no change would be registered and nothing would happen
                            scope.$eval(attributes.tzModal + ' = true');

                        });

                        return false;
                    };


                    scope.$watch(attributes.tzModal, function (value, oldValue) {

                        if (value !== oldValue)
                        {
                            if (value)
                            {
                                if (!transcluded)
                                {
                                    // Share scope
                                    transclude(scope, function (clone) {
                                        angular.element(element.children()[0]).append(clone);
                                    });
                                    transcluded = true;
                                }
                                modalStack.push(scope); // make sure this modal is set or moved on top of all the others
                                $timeout(function ()
                                {
                                    scope.modalVisible = true;
                                }, 0);
                            }
                            else
                            {
                                closeModal();
                            }
                        }

                    });


                    scope.stopPropagation = function (event) {

                        event.stopPropagation();
                        return false;

                    };

                    scope.$on('key_pressed_esc', function (listener, event) {

                        if (scope.modalVisible)
                        {
                            event.stopPropagation();
                            closeModal();
                            return false;
                        }

                    });
                    scope.$on('followGameLink', closeModal);

                    scope.inStack = false;

                    scope.zIndex = parseInt($window.getComputedStyle(element[0]).zIndex, 10);
                    scope.stackIndex = 0;

                };
            }
        };

    });


    /*
     modal-close is the large cross icon on the top right of a modal.
    */
    app.directive('modalClose', function () {

        return {
            replace: true,
            restrict: 'E',
            template: '<div class="modal-header-right">' +
                        '<div class="modal-header-separator cs-dark game-color-scheme game-color-scheme"></div><!--' +
                        '--><div class="modal-header-icon icon-tz-nav-close" ng-click="show = false; $event.stopPropagation()"></div>' +
                      '</div>'
        };

    });


    /*
     modal-refresh is the large "circle with arrow" icon on the top left of a modal.
    */
    app.directive('modalRefresh', function () {

        return {
            replace: true,
            restrict: 'E',
            template: '<div class="modal-header-left">' +
                        '<div class="modal-header-icon icon-tz-nav-refresh" ng-click="refresh(); $event.stopPropagation()"></div><!--' +
                        '--><div class="modal-header-separator cs-dark game-color-scheme"></div>' +
                      '</div>'
        };

    });


    app.directive('tzInput', function () {

        return {
            restrict: 'E',
            replace: true,
            scope: {
                model: '=',
                returnKey: '&',
                'class': '@',
                cs: '=',
                tzMaxlength: '='
            },
            //template: '<input ng-model="model" ng-pattern="pattern"' +
            template: '<input ng-model="model"' +
                    'ng-keydown="keydown($event)" ng-keyup="keyup($event)" ' +
                    'class="{{class}}" ' +
                    'ng-class="cs" ' +
                    'maxlength="{{tzMaxlength}}"></input>',
            link: function (scope /*, element, attrs*/) {

                scope.patternDD = /^\d{1,2}$/;
                scope.patternMM = scope.patternDD;
                scope.patternYYYY = /^\d{4}$/;

                scope.keydown = function ($event)
                {
                    // Check for the RETURN key.
                    if ($event.keyCode === 13)
                    {
                        $event.preventDefault();    // stop a newline being put into the text.
                    }
                };
                scope.keyup = function ($event)
                {
                    // Submit if the RETURN key is used.
                    if ($event.keyCode === 13)
                    {
                        scope.returnKey();
                    }
                };
            }
        };

    });

    app.directive('modalError', function () {

        return {
            replace: true,
            restrict: 'E',
            scope: {
                errorMessage: '=',
                cs: '='
            },
            template: '<div ng-show="errorMessage" class="modal-error">' +
                        '<div class="modal-error-icon icon-tz-nav-close" ng-click="errorMessage=null; $event.stopPropagation()"></div><!--' +
                        '--><div ng-bind="errorMessage" class="modal-error-text"></div>' +
                      '</div>'
        };

    });


})(window.angular, window._);
