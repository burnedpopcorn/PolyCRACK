'use strict';

(function (angular, _)
{
    angular.module('gamesite.services', []);
    angular.module('engine.services', []);

    var app = angular.module('game.host', ['ngRoute', 'gamesite.services', 'engine.services']);

    var baseUrl = "https://ga.me";

    app.value('baseUrl', baseUrl);
    app.value('slug', 'polycraft');
    app.value('gameTitle', 'Polycraft');

    app.config(function ($routeProvider, $httpProvider, $provide)
    {
        $routeProvider.when('/play', {
            controller: 'play',
            templateUrl: '/js/app/game.partial.html'
        });
        $routeProvider.when('/login', {
            controller: 'login',
            templateUrl: '/js/app/login.partial.html'
        });
        $routeProvider.when('/merge', {
            controller: 'merge',
            templateUrl: '/js/app/merge.partial.html'
        });
        $routeProvider.when('/version', {
            templateUrl: '/js/app/version.partial.html'
        });
        $routeProvider.otherwise({redirectTo: '/login'});

        // Prepend http requests with turbulenz.com for api and dynamic
        // http endpoints

        var wrapURLPrefix = function ($delegate)
        {
            function wrapURL(url)
            {
                if (/^\/((api\/v1\/)|(dynamic\/))/.test(url))
                {
                    return (baseUrl + url);
                }
                else
                {
                    return url;
                }
            }

            function wrapCall(original)
            {
                return function (url, param1, param2)
                {
                    return $delegate[original](wrapURL(url), param1, param2);
                };
            }

            var wrappedHttp = function (config)
            {
                config.url = wrapURL(config.url);
                return $delegate(config);
            };

            var methods = ['get', 'head', 'post', 'put', 'delete', 'jsonp'];
            _.forEach(methods, function (methodName)
            {
                wrappedHttp[methodName] = wrapCall(methodName);
            });

            wrappedHttp.setCacheProvider = $delegate.setCacheProvider;

            return wrappedHttp;
        };

        var wrapRetry = function ($delegate, $q, $timeout, online)
        {
            var maxTries = 10;
            var baseRetryTime = 500;
            var maxRetryTime = 8000;
            var tryAgain = function (postRequest, deferred, numTries)
            {
                postRequest().then(function (response)
                {
                    deferred.resolve(response);
                },
                function (errResponse)
                {
                    var retry_codes = [0, 408, 429, 480];
                    if (numTries > 0 && _.contains(retry_codes, errResponse.status) && online.test())
                    {
                        var timeout = Math.min(baseRetryTime * Math.pow(2, (maxTries - numTries)), maxRetryTime);
                        $timeout(function ()
                        {
                            tryAgain(postRequest, deferred, numTries - 1);
                        }, timeout);
                    }
                    else
                    {
                        deferred.reject(errResponse);
                    }
                });
            };


            function wrapCall(original)
            {
                return function (url, param1, param2)
                {
                    var deferred = $q.defer();
                    tryAgain(function ()
                    {
                        return $delegate[original](url, param1, param2);
                    }, deferred, maxTries);
                    return deferred.promise;
                };
            }

            var wrappedHttp = function (config)
            {
                var deferred = $q.defer();
                tryAgain(function ()
                {
                    return $delegate(config);
                }, deferred, maxTries);
                return deferred.promise;
            };

            var methods = ['get', 'head', 'post', 'put', 'delete', 'jsonp'];
            _.forEach(methods, function (methodName)
            {
                wrappedHttp[methodName] = wrapCall(methodName);
            });

            return wrappedHttp;
        };

        var wrapCachedResponses = function ($delegate, $q, $log, online)
        {
            var cacheProvider = null;

            var getFromCache = function (unsanitisedKey)
            {
                var key = unsanitisedKey.toLowerCase();
                var deferred = $q.defer();
                var cache = cacheProvider && cacheProvider.httpCache;
                if (cache && key in cache)
                {
                    deferred.resolve(cache[key]);
                }
                else
                {
                    $log.warn('MISS', key);
                    deferred.reject({
                        status: 404
                    });
                }
                return deferred.promise;
            };

            var addToCache = function (unsanitisedKey, request)
            {
                var cache = cacheProvider && cacheProvider.httpCache;
                if (cache)
                {
                    var key = unsanitisedKey.toLowerCase();
                    cache[key] = {data: request.data, status: request.status};
                }
            };

            function wrapCall(original)
            {
                return function (url, param1, param2)
                {
                    var domain = /^https?:\/\/([^\/?#]+)/.exec(url);
                    if (domain && domain[0] === baseUrl)
                    {
                        if (online.test())
                        {
                            var writeOperation = original === 'post' || original === 'put';
                            var config = (writeOperation ? param2 : param1) || {};
                            config.withCredentials = true;
                            var outParam1 = writeOperation ? param1 : config;
                            var outParam2 = writeOperation ? config : param2;
                            // Send and cache reply
                            return $delegate[original](url, outParam1, outParam2).then(function (response)
                            {
                                if (!writeOperation)
                                {
                                    addToCache(original + ':' + url, response);
                                }
                                return response;
                            });
                        }
                        else
                        {
                            return getFromCache(original + ':' + url);
                        }
                    }
                    else
                    {
                        return $delegate[original](url, param1, param2);
                    }
                };
            }

            var wrappedHttp = function (config)
            {
                var domain = /^https?:\/\/([^\/?#]+)/.exec(config.url);
                if (domain && domain[0] === baseUrl)
                {
                    if (online.test() && !config.fromCache)
                    {
                        config.withCredentials = true;
                        return $delegate(config).then(function (response)
                        {
                            if (!config.doNotCache)
                            {
                                addToCache(config.method + ':' + config.url, response);
                            }
                            return response;
                        });
                    }
                    else
                    {
                        return getFromCache(config.method + ':' + config.url);
                    }
                }
                else
                {
                    return $delegate(config);
                }
            };

            var methods = ['get', 'head', 'post', 'put', 'delete', 'jsonp'];
            _.forEach(methods, function (methodName)
            {
                wrappedHttp[methodName] = wrapCall(methodName);
            });

            wrappedHttp.setCacheProvider = function (newCacheProvider)
            {
                cacheProvider = newCacheProvider;
            };

            return wrappedHttp;
        };

        $provide.decorator('$http', wrapRetry);
        $provide.decorator('$http', wrapCachedResponses);
        $provide.decorator('$http', wrapURLPrefix);


        // Use x-www-form-urlencoded Content-Type
        $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

        // Override $http service's default transformRequest
        $httpProvider.defaults.transformRequest = [function (data)
        {
            /**
             * from http://victorblog.com/2012/12/20/make-angularjs-http-service-behave-like-jquery-ajax/
             *
             * The workhorse; converts an object to x-www-form-urlencoded serialization.
             * @param {Object} obj
             * @return {String}
             */
            var param = function (obj)
            {
                var query = '';
                var name, value, fullSubName, subValue, innerObj, i;

                for (name in obj)
                {
                    value = obj[name];

                    if (value instanceof Array)
                    {
                        for (i = 0; i < value.length; i += 1)
                        {
                            subValue = value[i];
                            fullSubName = name + '[' + i + ']';
                            innerObj = {};
                            innerObj[fullSubName] = subValue;
                            query += param(innerObj) + '&';
                        }
                    }
                    else if (value instanceof Object)
                    {
                        for (var subName in value)
                        {
                            subValue = value[subName];
                            fullSubName = name + '[' + subName + ']';
                            innerObj = {};
                            innerObj[fullSubName] = subValue;
                            query += param(innerObj) + '&';
                        }
                    }
                    else if (value !== undefined && value !== null)
                    {
                        query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
                    }
                }

                return query.length ? query.substr(0, query.length - 1) : query;
            };

            return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
        }];


        $httpProvider.interceptors.push(['$q', function ($q) {

            return {
                response: function interceptorResponseFn(response) {

                    var data = response.data;
                    if (data && !angular.isUndefined(data.ok) && !data.ok)
                    {
                        if (data.status)
                        {
                            response.status = data.status;
                        }
                        return $q.reject(response);
                    }
                    else
                    {
                        return response;
                    }

                }
            };

        }]);

    });

    app.controller('login', function ($scope, $http, $location, $window, $q, $timeout, online, localStorage, oauth, slug)
    {
        var goOnline = function ()
        {
            // Do we have stored stuff to send?
            // Is stuff on server in sync?
                // Yes - send local data
                // No - discard local data

            // Get latest state from server
            $http.get('/api/v1/profiles/user');
            $http.get('/api/v1/store/user/items/read/' + slug);
        };

        // Handle changes in online state
        online.registerOnlineCallback(goOnline);

        var initialiseCache = function (cache)
        {
            var addToCache = function (url, resource)
            {
                var key = ("get:" + baseUrl + url).toLowerCase();
                if (!cache[key] || cache[key].status !== 200)
                {
                    if (_.isString(resource))
                    {
                        $http.get(resource).then(function (response)
                        {
                            cache[key] = {data: response.data, status: 200};
                        });
                        cache[key] = {data: {}, status: 503};
                    }
                    else
                    {
                        cache[key] = {data: resource, status: 200};
                    }
                }
            };

            addToCache('/api/v1/badges/read/' + slug, '/badges.json');
            addToCache('/api/v1/leaderboards/read/' + slug, '/leaderboards.json');
            addToCache('/api/v1/store/items/read/' + slug, '/storeitems.json');
            addToCache('/api/v1/game-notifications/keys/read/' + slug, '/gamenotifications.json');
            addToCache('/api/v1/game-notifications/usersettings/read/' + slug, {
                data: {
                    site_setting: 0,
                    email_setting: 0,
                    game_followed: 0
                },
                ok: true
            });
            addToCache('/api/v1/store/user/items/read/' + slug, {
                data: {userItems: {}},
                ok: true
            });
            addToCache('/api/v1/profiles/user', {
                data: {
                    username: "guest-00000",
                    displayname: "Unregistered User",
                    guest: false,
                    language: "en",
                    country: "GB",
                    anonymous: false
                },
                ok: true
            });
        };

        var hideConnecting = function ()
        {
            $scope.showConnecting = false;
        };

        var showConnecting = function ()
        {
            $scope.showConnecting = true;
            $scope.dots = '';
            var updateDots = function ()
            {
                if ($scope.dots.length > 8)
                {
                    $scope.dots = '';
                }
                $scope.dots += '.';
                if ($scope.showConnecting)
                {
                    $timeout(updateDots, 500);
                }
            };
            updateDots();
        };


        var playGame = function ()
        {
            hideConnecting();
            if (online.test())
            {
                goOnline();
            }
            $location.path('/play');
        };

        var setupCreateAccount = function (oAuthToken)
        {
            $http.get("https://www.googleapis.com/userinfo/v2/me",
            {
                headers: {
                    'Authorization': "Bearer " + oAuthToken
                }
            }).then(function (response)
            {
                hideConnecting();
                $scope.oAuthToken = oAuthToken;
                $scope.username = /^[^@]*/.exec(response.data.email)[0];
                $scope.email = response.data.email;
                $scope.baseUrl = baseUrl;
                $scope.promptCreate = true;
                angular.element($window).one('focus', function ()
                {
                    $scope.$apply(function ()
                    {
                        login(oAuthToken).then(playGame);
                    });
                });
            }, function ()
            {
                // We probably have a bad auth token - drop it and try the whole thing
                // again
                oauth.signOut();
                $scope.initialise();
            });
        };

        var login = function (oAuthToken)
        {
            return $http.post('/dynamic/login', {
                auth_provider: 'googleplay',
                credentials: oAuthToken,
                rememberme: true
            }).then(angular.noop, function ()
            {
                setupCreateAccount(oAuthToken);
                return $q.reject();
            });
        };


        $scope.initialise = function ()
        {
            localStorage.initialise().then(function ()
            {
                localStorage.httpCache = localStorage.httpCache || {};
                initialiseCache(localStorage.httpCache);
                $http.setCacheProvider(localStorage);

                if (online.test())
                {
                    // try and log in to google play
                    oauth.signIn().then(function (oAuthToken)
                    {
                        document.getElementById('login-webview').src = baseUrl + '/acergames/#' + oAuthToken;

                        showConnecting();
                        if (localStorage.playedBefore)
                        {
                            $http.get('/dynamic/login-status').then(function (response)
                            {
                                if (response.data.value)
                                {
                                    playGame();
                                }
                                else
                                {
                                    login(oAuthToken).then(playGame);
                                }
                            }, $scope.play);
                        }
                        else
                        {
                            localStorage.playedBefore = true;
                            login(oAuthToken).then(playGame);
                        }
                    }, $scope.play);
                }
                else
                {
                    $scope.play();
                }
            });
        };

        $scope.createAccount = function ()
        {
            if (!$scope.disablePlay)
            {
                var username = $scope.username;
                $http.post('/dynamic/registration', {
                    auth_provider: 'googleplay',
                    credentials: $scope.oAuthToken,
                    username: username,
                    agreeterms: "true"
                }).then(function ()
                {
                    $scope.initialise();
                },
                function (response)
                {
                    var data = response.data || {};
                    var incorrect_fields = data.incorrect_fields || {};
                    if (incorrect_fields.username === "This username is not available")
                    {
                        $scope.takenUsernames[username] = true;
                    }
                });
            }
        };

        $scope.takenUsernames = $scope.takenUsernames || {};

        var validateUsername = function (name)
        {
            if (!_.isUndefined(name))
            {
                if (/[^a-zA-Z0-9\-]/.exec(name))
                {
                    $scope.errorMessage = "Username may only contain letters, numbers and hyphens";
                    $scope.disablePlay = true;
                }
                else if (name.length < 3 || name.length > 20)
                {
                    $scope.errorMessage = "Username must be between 3 and 20 characters long";
                    $scope.disablePlay = true;
                }
                else if ($scope.takenUsernames[name])
                {
                    $scope.errorMessage = "Username already in use, please choose something else";
                    $scope.disablePlay = true;
                }
                else
                {
                    $scope.errorMessage = false;
                    $scope.disablePlay = false;
                }
            }
        };

        $scope.$watch('username', validateUsername);
        $scope.$watch('takenUsernames', function () { validateUsername($scope.username); }, true);

        $scope.play = function ()
        {
            online.forceOffline();
            hideConnecting();
            $scope.showLinkInfo = false;
            $scope.showOffline = true;
            $timeout(playGame, 3000);
        };
    });

    app.controller('play', function ($scope, $http, $window, $location, oauth, slug, localStorage, online, sync, socket)
    {
        $scope.hasLocalData = function ()
        {
            return !_.isEmpty(localStorage.httpCache) || !_.isEmpty(localStorage.data.userData);
        };

        $scope.isOnline = online.test;

        if (online.test())
        {
            $scope.hasRemoteData = true;
        }

        var uploadData = function ()
        {
            sync.test().then(angular.noop, function () {
                sync.resolve({keepLocal: true});
            });
        };

        online.registerOnlineCallback(uploadData);

        $scope.$on('$destroy', function ()
        {
            online.removeOnlineCallback(uploadData);
        });

        $scope.play = function ()
        {
            sync.test().then(function ()
            {
                if ($scope.game)
                {
                    $scope.game.playing = true;
                }
                else
                {
                    $scope.game = {
                        slug: slug,
                        playing: true
                    };
                }
                if (online.test())
                {
                    socket.open();

                    $window.addEventListener('message', function (e)
                    {
                        if (e.data === 'TurbulenzEngine.onunload')
                        {
                            socket.close();
                        }
                    });

                    $scope.hasRemoteData = true;
                }
            }, function () {
                $location.path('/merge');
            });
        };

        $scope.logout = function ()
        {
            oauth.signOut();
            // The dummy parameter forces the request to be formatted correctly
            $http.post('/dynamic/logout', {a: 'a'}).then(function ()
            {
                $location.path('/login');
            },
            function ()
            {
                $location.path('/login');
            });
        };

        $scope.clearLocalData = function ()
        {
            localStorage.httpCache = {};
            localStorage.data = {};
        };

        $scope.clearRemoteData = function ()
        {
            $http.post('/api/v1/games/create-session/' + slug + '/canvas').then(function (response)
            {
                var closeSession = function ()
                {
                    $http.post('/api/v1/games/destroy-session', {
                        gameSessionId: response.data.gameSessionId
                    });
                };
                $http.post('/api/v1/user-data/remove-all', {
                    gameSessionId: response.data.gameSessionId
                }).then(function ()
                {
                    $scope.hasRemoteData = false;
                    closeSession();
                }, closeSession);
            });
        };
    });

    app.controller('merge', function ($scope, $location, sync)
    {
        $scope.local = sync.getLocalSaveInfo();
        $scope.server = sync.getRemoteSaveInfo();

        $scope.keepLocal = function ()
        {
            sync.resolve({keepLocal: true}).then(function ()
            {
                $location.path('/play');
            });
        };

        $scope.keepServer = function ()
        {
            sync.resolve({keepLocal: false}).then(function ()
            {
                $location.path('/play');
            });
        };

    });


    app.directive('externalSrc', function ($http) {

        return {
            restrict: 'A',
            replace: true,
            template: '<img ng-src="{{ src }}" />',
            link: function (scope, el, attrs) {
                attrs.$observe('externalSrc', function (url) {
                    $http.get('/' + url, {responseType: 'blob'}).then(function (response) {
                        scope.src = window.URL.createObjectURL(response.data);
                    });
                });
            }
        };

    });


    app.run(['$rootScope', '$sce', function ($rootScope, $sce) {

        $rootScope.trustAsHtml = $sce.trustAsHtml;

        // Add safe apply for non-deterministically asynchronous updates
        $rootScope.safeApply = function (functionOrExpression)
        {
            if (!this.$$phase)
            {
                this.$apply(functionOrExpression);
            }
            else
            {
                this.$eval(functionOrExpression);
            }
        };
    }]);

})(window.angular, window._);
