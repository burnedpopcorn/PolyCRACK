/*global describe, beforeEach, it, spyOn*/
/*global angular, inject, module*/

describe('Unit Tests:', function ()
{
    var baseUrl;

    var mockOnline = {
        value: true,
        test: function ()
        {
            return this.value;
        },
        registerOnlineCallback: angular.noop,
        registerOfflineCallback: angular.noop
    };

    describe('host application routing', function ()
    {
        beforeEach(module('game.host'));

        beforeEach(inject(['baseUrl', function (baseUrlValueFromModule)
        {
            // this just has to happen once...
            baseUrl = baseUrlValueFromModule;
        }]));

        beforeEach(inject(function ($httpBackend)
        {
            $httpBackend.whenGET('/js/app/login.partial.html').respond([]);
            $httpBackend.whenGET('/js/app/game.partial.html').respond([]);
        }));

        it('should add a play route', inject(function ($route)
        {
            expect($route.routes['/play']).not.toBeUndefined();
        }));

        it('which should load the play template', inject(function ($route)
        {
            expect($route.routes['/play'].templateUrl).toBe('/js/app/game.partial.html');
        }));

        it('should add a login route', inject(function ($route)
        {
            expect($route.routes['/login']).not.toBeUndefined();
        }));

        it('which should load the login template', inject(function ($route)
        {
            expect($route.routes['/login'].templateUrl).toBe('/js/app/login.partial.html');
        }));

        it('the login route should be the default', inject(function ($route, $location, $httpBackend, $rootScope)
        {
            $httpBackend.expectGET('/js/app/login.partial.html').respond([]);
            $location.path('/dummy');
            $httpBackend.flush();
            $rootScope.$apply();
            expect($route.current.$$route).toBe($route.routes['/login']);
        }));

        it('should register the controllers with the routes', inject(function ($route)
        {
            expect($route.routes['/login'].controller).toBe('login');
            expect($route.routes['/play'].controller).toBe('play');
        }));

        it('should register a login controller', inject(function ($controller, $rootScope)
        {
            expect($controller('login', { $scope: $rootScope })).toBeTruthy();
        }));

        it('should register a play controller', inject(function ($controller, $rootScope)
        {
            expect($controller('play', { $scope: $rootScope })).toBeTruthy();
        }));
    });

    describe('the mock gameModes service', function ()
    {
        beforeEach(module('game.host'));

        it('should exist', inject(function (gameModes)
        {
            expect(gameModes).toBeDefined();
        }));

        it('should return a game synchronously', inject(function (gameModes, $rootScope)
        {
            var test = null;
            gameModes.get('anything').then(function (modes)
            {
                test = modes;
            });
            $rootScope.$apply();
            expect(test).not.toBeNull();
            expect(test.canvas).toBeDefined();
            expect(test.canvas.url).toBe("game.canvas.js");
        }));

    });

    describe('the wrapped http service', function ()
    {
        beforeEach(module('game.host'));
        beforeEach(function ()
        {
            module(function ($provide)
            {
                $provide.value('online', mockOnline);
            });
        });

        afterEach(inject(function ($httpBackend) {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        }));

        var testHTTP = function (url, expectedPrefix, $http, $httpBackend)
        {
            var methods = ['get', /*'head',*/ 'post', 'put', 'delete', 'jsonp'];
            _.forEach(methods, function (methodName)
            {
                var mU = methodName.toUpperCase();
                $httpBackend['expect' + mU](expectedPrefix + url).respond("anything");
                $http[methodName](url);
                $httpBackend['expect' + mU](expectedPrefix + url).respond("anything");
                $http({ method: mU, url: url });
            });
        };


        it('should not wrap calls to load files or ot other services', inject(function ($http, $httpBackend)
        {
            testHTTP('/js/test.js', '', $http, $httpBackend);
            testHTTP('http://twitter.com/readstuff', '', $http, $httpBackend);
            $httpBackend.flush();
        }));

        it('should wrap calls to api/v1', inject(function ($http, $httpBackend)
        {
            testHTTP('/api/v1/user/read', baseUrl + '', $http, $httpBackend);
            $httpBackend.flush();
        }));

        it('should wrap calls to dynamic', inject(function ($http, $httpBackend)
        {
            testHTTP('/dynamic/login', baseUrl + '', $http, $httpBackend);
            $httpBackend.flush();
        }));
    });

    describe('The online service', function ()
    {
        var mockWindow = {
            events: {},
            navigator: {
                onLine: false
            },
            addEventListener: function (event, callback)
            {
                this.events[event] = callback;
            }
        };

        beforeEach(module('game.host'));

        beforeEach(function ()
        {
            module(function ($provide)
            {
                $provide.value('$window', mockWindow);
            });
        });

        it('should exist', inject(function (online)
        {
            expect(online).toBeDefined();
        }));

        it('should return true or false from the test function', inject(function (online)
        {
            mockWindow.navigator.onLine = true;
            expect(online.test()).toBe(true);
            mockWindow.navigator.onLine = false;
            expect(online.test()).toBe(false);
        }));

        it('should register online and offline events', inject(function (online) {
            var onlineFunction = jasmine.createSpy('onlineFunction');
            var offlineFunction = jasmine.createSpy('offlineFunction');
            online.registerOnlineCallback(onlineFunction);
            online.registerOfflineCallback(offlineFunction);
            mockWindow.events.online();
            expect(onlineFunction).toHaveBeenCalled();
            mockWindow.events.offline();
            expect(offlineFunction).toHaveBeenCalled();
        }));
    });

    describe('The cached HTTP system', function ()
    {
        var mockData1 = {test11: "test1", test12: "test_1"};
        var mockData2 = {test21: "test2", test22: "test_2"};
        var mockData3 = {test31: "test3", test32: "test_3"};
        var mockData4 = {test41: "test4", test42: "test_4"};

        beforeEach(module('game.host'));

        beforeEach(function ()
        {
            module(function ($provide)
            {
                $provide.value('online', mockOnline);
                $provide.value('localStorage', {
                });
            });
        });

        beforeEach(inject(function ($http)
        {
            $http.setCacheProvider({httpCache: {}});
        }));

        afterEach(inject(function ($httpBackend) {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        }));

        it('should pass through results when online', inject(function ($http, $httpBackend, $rootScope) {
            var result1 = null, result2 = null, result3 = null, result4 = null;
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read').respond(mockData1);
            $httpBackend.expectGET('/js/test/something').respond("some data 1");
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result1 = val.data; });
            $http.get('/js/test/something').then(function (val) { result2 = val.data; });
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read2').respond(mockData2);
            $httpBackend.expectGET('/js/test/something').respond("some data 2");
            $http({method: 'get', url: baseUrl + '/api/v1/user/read2'}).then(function (val) { result3 = val.data; });
            $http({method: 'get', url: '/js/test/something'}).then(function (val) { result4 = val.data; });
            $httpBackend.flush();
            $rootScope.$apply();

            expect(result1).toBe(mockData1);
            expect(result2).toBe("some data 1");
            expect(result3).toBe(mockData2);
            expect(result4).toBe("some data 2");
        }));

        it('should return cached results to turbulenz.com when offline', inject(function ($http, $httpBackend, $rootScope) {
            var result1 = null, result2 = null, result3 = null, result4 = null, result5 = null, result6 = null;
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read').respond(mockData3);
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read2').respond(mockData4);
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result1 = val.data; });
            $http({method: 'get', url: baseUrl + '/api/v1/user/read2'}).then(function (val) { result2 = val.data; });
            $httpBackend.flush();
            $rootScope.$apply();

            mockOnline.value = false;
            $httpBackend.expectGET('/js/test/something').respond("some data 3");
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result3 = val.data; });
            $http.get('/js/test/something').then(function (val) { result4 = val.data; });
            $httpBackend.expectGET('/js/test/something').respond("some data 4");
            $http({method: 'get', url: baseUrl + '/api/v1/user/read2'}).then(function (val) { result5 = val.data; });
            $http({method: 'get', url: '/js/test/something'}).then(function (val) { result6 = val.data; });
            $httpBackend.flush();
            $rootScope.$apply();
            mockOnline.value = true;

            expect(result1).toBe(mockData3);
            expect(result2).toBe(mockData4);

            expect(result3).toBe(mockData3);
            expect(result4).toBe("some data 3");
            expect(result5).toBe(mockData4);
            expect(result6).toBe("some data 4");
        }));

        it('should return a 404 if a result is not cached', inject(function ($http, $httpBackend, $rootScope) {
            var result1 = null, result2 = null;

            mockOnline.value = false;
            $http.get(baseUrl + '/api/v1/user/read_xxx').then(angular.noop,
                function (val) { result1 = val.status; });
            $http({method: 'get', url: baseUrl + '/api/v1/user/read_yyy'}).then(angular.noop,
                function (val) { result2 = val.status; });
            $rootScope.$apply();
            mockOnline.value = true;

            expect(result1).toBe(404);
            expect(result2).toBe(404);
        }));

        it('should pass through results when online again', inject(function ($http, $httpBackend, $rootScope) {
            var result1 = null, result2 = null, result3 = null;
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read').respond(mockData1);
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result1 = val.data; });
            $httpBackend.flush();
            $rootScope.$apply();

            mockOnline.value = false;
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result2 = val.data; });
            $rootScope.$apply();

            mockOnline.value = true;
            $httpBackend.expectGET(baseUrl + '/api/v1/user/read').respond(mockData2);
            $http.get(baseUrl + '/api/v1/user/read').then(function (val) { result3 = val.data; });
            $httpBackend.flush();
            $rootScope.$apply();

            expect(result1).toBe(mockData1);
            expect(result2).toBe(mockData1);
            expect(result3).toBe(mockData2);
        }));
    });

    describe('The delegate object', function ()
    {
        var delegate;
        beforeEach(module('game.host'));

        beforeEach(inject(function (utilities)
        {
            delegate = utilities.delegate();
        }));

        it('should be on the utilities service', inject(function (utilities)
        {
            expect(utilities.delegate).toBeDefined();
        }));

        it('should add callbacks with the add function', function ()
        {

            expect(delegate.add).toBeDefined();

            var test1 = jasmine.createSpy('test1');

            delegate.add(test1);

            delegate();

            expect(test1).toHaveBeenCalled();
        });

        it('should add multiple callbacks with the add function', function ()
        {
            var test1 = jasmine.createSpy('test1');
            var test2 = jasmine.createSpy('test2');
            var test3 = jasmine.createSpy('test3');

            delegate.add(test1);
            delegate.add(test2);
            delegate.add(test3);

            delegate();

            expect(test1).toHaveBeenCalled();
            expect(test2).toHaveBeenCalled();
            expect(test3).toHaveBeenCalled();
        });

        it('should remove callbacks with the remove function', function ()
        {
            var test1 = jasmine.createSpy('test1');
            var test2 = jasmine.createSpy('test2');
            var test3 = jasmine.createSpy('test3');

            delegate.add(test1);
            delegate.add(test2);
            delegate.add(test3);

            delegate();
            delegate.remove(test2);
            delegate();

            expect(test1.calls.length).toEqual(2);
            expect(test2.calls.length).toEqual(1);
            expect(test3.calls.length).toEqual(2);
        });

        it('should remove callbacks with the return value of add', function ()
        {
            var test1 = jasmine.createSpy('test1');
            var test2 = jasmine.createSpy('test2');
            var test3 = jasmine.createSpy('test3');

            delegate.add(test1);
            var remove = delegate.add(test2);
            delegate.add(test3);

            delegate();
            remove();
            delegate();

            expect(test1.calls.length).toEqual(2);
            expect(test2.calls.length).toEqual(1);
            expect(test3.calls.length).toEqual(2);

        });

        it('should pass through arguments to all registered callbacks', function ()
        {
            var test1 = jasmine.createSpy('test1');
            var test2 = jasmine.createSpy('test2');
            var test3 = jasmine.createSpy('test3');

            delegate.add(test1);
            delegate.add(test2);
            delegate.add(test3);

            delegate('a', 'b', 'c', 'd');

            expect(test1).toHaveBeenCalledWith('a', 'b', 'c', 'd');
            expect(test2).toHaveBeenCalledWith('a', 'b', 'c', 'd');
            expect(test3).toHaveBeenCalledWith('a', 'b', 'c', 'd');
        });
    });
    describe('The sync service', function ()
    {
        var mockBridgeServices = {
            registerService: angular.noop,
            respondifOffline: angular.noop,
            startSyncing: angular.noop,
            endSyncing: angular.noop,
            removeAllEvents: angular.noop,
            removeAllItems: angular.noop,
            removeAllBadges: angular.noop,
            getItem: angular.noop,
            setItem: angular.noop,
            setBadge: angular.noop,
            getBadge: angular.noop,
            setEvent: angular.noop,
            getEvent: angular.noop
        };
        var mockGamePlayer = {};

        beforeEach(module('game.host'));

        beforeEach(function ()
        {
            module(function ($provide)
            {
                $provide.value('online', mockOnline);
                $provide.value('bridgeServices', mockBridgeServices);
                $provide.value('slug', 'test-game');
                $provide.value('gamePlayer', mockGamePlayer);
            });
        });

        beforeEach(inject(function ($http)
        {
            $http.setCacheProvider({httpCache: {}});
        }));

        afterEach(inject(function ($httpBackend) {
            $httpBackend.verifyNoOutstandingExpectation();
        }));

        it('should exist', inject(function (sync)
        {
            expect(sync).toBeDefined();
        }));

        it('should have the API functions', inject(function (sync)
        {
            expect(sync.test).toBeDefined();
            expect(sync.resolve).toBeDefined();
            expect(sync.setGameSession).toBeDefined();
            expect(sync.clearGameSession).toBeDefined();
            expect(sync.getLocalSaveInfo).toBeDefined();
            expect(sync.getRemoteSaveInfo).toBeDefined();
        }));

        var expectResolve = function ($httpBackend, sessionId)
        {
            $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=' + sessionId).respond({});
            $httpBackend.expectGET(baseUrl + '/api/v1/badges/progress/read/test-game').respond({});
        };

        describe('The setGameSession function', function ()
        {

            it('should set the game session to be used', inject(function (sync, $httpBackend)
            {
                sync.setGameSession("xxxxx");
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=xxxxx').respond({});
                sync.resolve();
            }));

            it('should finalise any existing game session', inject(function (sync, $httpBackend)
            {
                sync.resolve();
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/create-session/test-game/canvas').respond({
                    gameSessionId: "yyyyyy"
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=yyyyyy').respond({
                    array: ['test1', 'test2']
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/badges/progress/read/test-game').respond({});
                $httpBackend.flush(1);

                sync.setGameSession("xxxxx");
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/destroy-session', "gameSessionId=yyyyyy").respond({});
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/test1?gameSessionId=xxxxx').respond({
                    value: "{}"
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/test2?gameSessionId=xxxxx').respond({
                    value: "{}"
                });
                $httpBackend.flush();
            }));
        });
        describe('The clearGameSession function', function ()
        {
            it('should sync the previous game session', inject(function (sync, $httpBackend)
            {
                sync.setGameSession("xxxxx");
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/gameStats?gameSessionId=xxxxx').respond({});
                sync.clearGameSession();
            }));

            it('should clear the game session to use', inject(function (sync, $httpBackend)
            {
                sync.setGameSession("xxxxx");
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/gameStats?gameSessionId=xxxxx').respond({});
                sync.clearGameSession();
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/create-session/test-game/canvas').respond({
                    gameSessionId: "aaaaa"
                });
                sync.resolve();
            }));
        });

        describe('The getLocalSaveInfo function', function ()
        {
            it('should cope with null data', inject(function (sync)
            {
                sync.localResponse = "{}";
                spyOn(mockBridgeServices, 'getItem').andReturn("{}");

                var data = sync.getLocalSaveInfo();

                expect(mockBridgeServices.getItem).toHaveBeenCalledWith('progress');
                expect(data.hours).toBe(0);
                expect(data.minutes).toBe(0);
                expect(data.totalXP).toBe(0);

                delete sync.localResponse;
                mockBridgeServices.getItem = angular.noop;
            }));

            it('should get the local data', inject(function (sync)
            {
                sync.localResponse = JSON.stringify({totalTimePlayed: (3600 * 12) + (60 * 7) + 35});
                mockBridgeServices.getItem = jasmine.createSpy('getItem').andReturn(JSON.stringify({xp: 'test'}));
                var data = sync.getLocalSaveInfo();

                expect(mockBridgeServices.getItem).toHaveBeenCalledWith('progress');
                expect(data.hours).toBe(12);
                expect(data.minutes).toBe(7);
                expect(data.totalXP).toBe('test');

                delete sync.localResponse;
                mockBridgeServices.getItem = angular.noop;
            }));
        });

        describe('The getRemoteSaveInfo function', function ()
        {
            it('should cope with null data', inject(function (sync, $httpBackend)
            {
                sync.serverResponse = "{}";
                sync.setGameSession("xxxxx");
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/progress?gameSessionId=xxxxx').respond({value: "{}"});

                var data;
                sync.getRemoteSaveInfo().then(function (d)
                {
                    data = d;
                });
                $httpBackend.flush();

                expect(data.hours).toBe(0);
                expect(data.minutes).toBe(0);
                expect(data.totalXP).toBe(0);

                delete sync.serverResponse;
            }));

            it('should get the remote data', inject(function (sync, $httpBackend)
            {
                sync.serverResponse = JSON.stringify({totalTimePlayed: (3600 * 12) + (60 * 7) + 35});
                sync.setGameSession("xxxxx");
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/progress?gameSessionId=xxxxx').respond({value: JSON.stringify({xp: 'test'})});

                var data;
                sync.getRemoteSaveInfo().then(function (d)
                {
                    data = d;
                });
                $httpBackend.flush();

                expect(data.hours).toBe(12);
                expect(data.minutes).toBe(7);
                expect(data.totalXP).toBe('test');

                delete sync.serverResponse;
            }));
        });

        describe('The resolve function', function ()
        {
            it('should open and close a new session if none exists', inject(function ($httpBackend, sync)
            {
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/create-session/test-game/canvas').respond({
                    gameSessionId: "yyyyyy"
                });
                sync.resolve();
            }));

            it('should close the new session if it creates one', inject(function ($httpBackend, sync)
            {
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/create-session/test-game/canvas').respond({
                    gameSessionId: "yyyyyy"
                });
                expectResolve($httpBackend, 'yyyyyy');
                $httpBackend.expectPOST(baseUrl + '/api/v1/games/destroy-session', "gameSessionId=yyyyyy").respond({});
                sync.resolve();
                $httpBackend.flush();
            }));

            it('should use an existing session if one exists', inject(function ($httpBackend, sync)
            {
                sync.setGameSession('abababab');
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=abababab').respond({});
                sync.resolve();

            }));

            it('should copy data to the server when resolving with the local game', inject(function ()
            {
            }));

            it('should copy data from the server when resolving against the local game', inject(function ($httpBackend, sync)
            {
                spyOn(mockBridgeServices, "removeAllEvents");
                spyOn(mockBridgeServices, "removeAllItems");
                spyOn(mockBridgeServices, "removeAllBadges");
                spyOn(mockBridgeServices, "setItem");
                spyOn(mockBridgeServices, "setBadge");

                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=abababab').respond({});
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=abababab').respond({
                    array: ['test1', 'test2']
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/badges/progress/read/test-game').respond({
                    data: [ {badge_key: 'key1', current: 1},
                            {badge_key: 'key2', current: 2}]
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/test1?gameSessionId=abababab').respond({
                    value: 1
                });
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read/test2?gameSessionId=abababab').respond({
                    value: "2"
                });

                sync.setGameSession('abababab');
                sync.resolve();
                $httpBackend.flush();

                expect(mockBridgeServices.removeAllEvents).toHaveBeenCalled();
                expect(mockBridgeServices.removeAllItems).toHaveBeenCalled();
                expect(mockBridgeServices.removeAllBadges).toHaveBeenCalled();

                expect(mockBridgeServices.setItem).toHaveBeenCalledWith("test1", 1);
                expect(mockBridgeServices.setItem).toHaveBeenCalledWith("test2", "2");

                expect(mockBridgeServices.setBadge).toHaveBeenCalledWith("key1", 1);
                expect(mockBridgeServices.setBadge).toHaveBeenCalledWith("key2", 2);

                mockBridgeServices.removeAllEvents = angular.noop;
                mockBridgeServices.removeAllItems = angular.noop;
                mockBridgeServices.removeAllBadges = angular.noop;
                mockBridgeServices.setItem = angular.noop;
                mockBridgeServices.setBadge = angular.noop;
            }));

            it('should set the syncing flag while it is working', inject(function ($httpBackend, sync)
            {
                spyOn(mockBridgeServices, "startSyncing");
                spyOn(mockBridgeServices, "endSyncing");
                sync.setGameSession('abababab');
                $httpBackend.expectGET(baseUrl + '/api/v1/user-data/read?gameSessionId=abababab').respond({});
                expectResolve($httpBackend, 'abababab');
                sync.resolve();
                $httpBackend.flush(1);
                expect(mockBridgeServices.startSyncing).toHaveBeenCalled();
                expect(mockBridgeServices.endSyncing).not.toHaveBeenCalled();
                $httpBackend.flush(1);
                expect(mockBridgeServices.endSyncing).not.toHaveBeenCalled();
                $httpBackend.flush(1);
                expect(mockBridgeServices.endSyncing).toHaveBeenCalled();

                mockBridgeServices.startSyncing = angular.noop;
                mockBridgeServices.endSyncing = angular.noop;
            }));
        });

        describe('The test function', function ()
        {
        });
    });

});
