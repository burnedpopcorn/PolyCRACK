'use strict';
(function (angular)
{
    var module = angular.module('engine.services');

    module.service('userDataService', ['bridgeServices', 'online', 'localStorage',
                                       function (bridgeServices, online, localStorage)
    {
        this.getKeys = function userDataServiceGetKeysFn(unused, callback)
        {
            if (!online.test())
            {
                callback({
                    status: 200,
                    data: bridgeServices.getItemList()
                });
            }
        };

        this.exists = function userDataServiceExistsFn(request, callback)
        {
            if (!online.test())
            {
                var key = /\/(\w*)\/?$/.exec(request.url)[1];
                callback({
                    status: 200,
                    data: !!bridgeServices.getItem(key)
                });
            }
        };

        this.get = function userDataServiceGetFn(request, callback)
        {
            if (!online.test())
            {
                var key = /\/(\w*)\/?$/.exec(request.url)[1];
                var data = bridgeServices.getItem(key);
                if (data)
                {
                    callback({
                        status: 200,
                        value: data
                    });
                }
                else
                {
                    callback({
                        status: 404,
                        value: {}
                    });
                }
            }
        };

        this.set = function userDataServiceSetFn(request, callback)
        {
            var key = /\/(\w*)\/?$/.exec(request.url)[1];
            bridgeServices.setItem(key, request.data.value);
            if (online.test())
            {
                // Assume write will succeed and update the "last seen" value in the cache
                if (key === 'gameStats')
                {
                    var cacheKey = ('get:' + request.url).toLowerCase().replace('/set/', '/read/');
                    localStorage.httpCache[cacheKey] = {
                        data: {
                            ok: true,
                            value: request.data.value
                        },
                        status: 200
                    };
                }
            }
            else
            {
                callback({status: 200});
            }
        };

        this.remove = function userDataServiceRemoveFn(request, callback)
        {
            var key = /\/(\w*)\/?$/.exec(request.url)[1];
            bridgeServices.removeItem(key);
            if (!online.test())
            {
                callback({status: 200});
            }
        };

        this.removeAll = function userDataServiceRemoveAllFn(unused, callback)
        {
            bridgeServices.removeAllItems();
            if (!online.test())
            {
                callback({status: 200});
            }
        };
    }]);

    module.run(['userDataService', 'bridgeServices', function (userDataService, bridgeServices)
    {
        bridgeServices.registerService('userdata.getkeys', userDataService.getKeys, userDataService);
        bridgeServices.registerService('userdata.exists', userDataService.exists, userDataService);
        bridgeServices.registerService('userdata.get', userDataService.get, userDataService);
        bridgeServices.registerService('userdata.set', userDataService.set, userDataService);
        bridgeServices.registerService('userdata.remove', userDataService.remove, userDataService);
        bridgeServices.registerService('userdata.removeall', userDataService.removeAll, userDataService);
    }]);

})(window.angular);
