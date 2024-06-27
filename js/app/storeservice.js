'use strict';
(function (angular, _)
{

    var module = angular.module('engine.services');

    module.service('storeService', ['$http', '$q', '$rootScope', '$timeout', 'chrome', 'bridge', 'google', 'online', 'slug', 'tzModals',
                                    function ($http, $q, $rootScope, $timeout, chrome, bridge, google, online, slug, tzModals)
    {

        var currencies = {
            "JPY": {
                "currencyName": "Yen",
                "alphabeticCode": "JPY",
                "numericCode": 392,
                "minorUnitPrecision": 0,
                "htmlCode": "&yen;"
            },
            "USD": {
                "currencyName": "US Dollar",
                "alphabeticCode": "USD",
                "numericCode": 840,
                "minorUnitPrecision": 2,
                "htmlCode": "$"
            },
            "GBP": {
                "currencyName": "Pound Sterling",
                "alphabeticCode": "GBP",
                "numericCode": 826,
                "minorUnitPrecision": 2,
                "htmlCode": "&pound;"
            },
            "EUR": {
                "currencyName": "Euro",
                "alphabeticCode": "EUR",
                "numericCode": 978,
                "minorUnitPrecision": 2,
                "htmlCode": "&euro;"
            }
        };
        var storeOfferings = {};
        var storeResources = {};

        this.basketContents = {
            items: {},
            total: 0,
            currency: currencies.USD
        };

        this.consumeUserItems = function (data, callback)
        {
            if (!online.test())
            {
                callback({
                    status: 404
                });
            }
        };

        var storeMetaPromise = null;
        this._fetchStoreMeta = function ()
        {
            // TODO: look into sorting out CORS issues with images, so we can get live-data here
            return $http.get('/storeitems.json');
        };
        this.getStoreMeta = function getStoreMeta() {

            if (!storeMetaPromise)
            {
                storeMetaPromise = this._fetchStoreMeta();
            }

            return storeMetaPromise.then(function (results) {

                var response = results;
                var currencyInfo = currencies;
                var currencyCode = 'USD';
                var currency = currencyInfo[currencyCode];
                var alphabeticCode = currency.alphabeticCode;
                var storeMeta = response.data.data;

                storeOfferings = storeMeta.items;
                storeResources = storeMeta.resources;
                _.forEach(storeOfferings, function (item) {
                    item.price = item.prices[alphabeticCode] / 100.0;
                });

                var result = {
                    currency: currency,
                    offerings: storeMeta.items,
                    resources: storeMeta.resources
                };

                bridge.emit('store.meta.v2', JSON.stringify(result));

                return result;
            });
        };


        this._calculateBasket = function (newBasketItems, callback) {

            var currencyCode = 'USD';
            var currency = currencies[currencyCode];
            var total = 0;

            if (_.isEmpty(newBasketItems))
            {
                // .. and if it's empty, do an early out ..

                if (angular.isFunction(callback))
                {
                    callback({}, total, currency);
                }
            }
            else
            {
                // .. otherwise calculate totals and return them
                var storeItem, storeItemPrice, amount, lineTotal;
                var calculatedItems = _.reduce(newBasketItems, function (dict, item, key) {

                    storeItem = storeOfferings[key];
                    // dont add any items that are no longer in the store
                    // possible if developer changes store item keys
                    if (storeItem && storeItem.available)
                    {
                        storeItemPrice = storeItem.prices[currencyCode];
                        amount = item.amount;
                        if (amount > 999)
                        {
                            amount = 999;
                        }
                        lineTotal = storeItemPrice * amount;

                        dict[key] = {
                            amount: amount,
                            price: storeItemPrice,
                            lineTotal: lineTotal,
                            output: storeItem.output
                        };
                        total = total + lineTotal;
                    }
                    return dict;
                }, {});

                if (angular.isFunction(callback))
                {
                    callback(calculatedItems, total, currency);
                }
            }

        };

        this.resetBasket = function (newBasketItems, callback) {

            newBasketItems = newBasketItems || {};

            // .. calculate the basket contents ..
            var that = this;
            this._calculateBasket(newBasketItems, function (calculatedItems, total, currency) {

                that.basketContents = {
                    items: calculatedItems,
                    total: total,
                    currency: currencies.USD
                };

                if (angular.isFunction(callback))
                {
                    callback(calculatedItems, total, currency);
                }
            });
        };

        this.onUpdateBasket = function (jsonParams) {

            var newBasketItems;
            var token;
            if (jsonParams)
            {
                var params = JSON.parse(jsonParams);
                newBasketItems = params.basketItems;
                token = params.token;
            }

            this.resetBasket(newBasketItems, function (basketItems, total, currency) {

                var out = JSON.stringify({
                    currency: currency,
                    total: total / 100.0,//total.toMajorUnit(),

                    items: _.reduce(basketItems, function (dict, item, key) {
                        dict[key] = {
                            amount: item.amount,
                            price: item.price / 100.0,
                            lineTotal: item.lineTotal / 100.0,
                            output: item.output
                        };
                        return dict;
                    }, {}),
                    token: token
                });

                // .. and tell everybody about it
                bridge.emit('basket.site.update', out);

            });

        };

        this.purchaseShowConfirm = function () {

            if (!online.test())
            {
                bridge.emit('purchase.rejected');
                return;
            }

            tzModals.show('basket');
        };

        this.rejectPurchase = function () {
            bridge.emit('purchase.rejected');
        };


        this.confirmPurchase = function () {
            bridge.emit('purchase.confirmed');
        };


        this.removeBasketItem = function (key) {
            var slot = this.basketContents.items[key];

            if (slot && slot.amount > 0)
            {
                slot.amount -= 1;
                if (!slot.amount)
                {
                    delete this.basketContents.items[key];
                }

                this.resetBasket(this.basketContents.items);
            }
        };

    }]);


    module.run(['storeService', 'bridgeServices', 'bridge', function (storeService, bridgeServices, bridge)
    {
        bridgeServices.registerService('store.useritems', bridgeServices.getCachedResponse);
        bridgeServices.registerService('store.useritems-consume', storeService.consumeUserItems, storeService);

        bridge.on('fetch.store.meta', function () { storeService.getStoreMeta(); });
        bridge.on('purchase.show.confirm', function () { storeService.purchaseShowConfirm(); });
        bridge.on('basket.game.update.v2', function (event, jsonParams) { storeService.onUpdateBasket(jsonParams); });

    }]);

})(window.angular, window._);
