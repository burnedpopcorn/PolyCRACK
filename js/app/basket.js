'use strict';

/*jshint es5: true */
/*123global PaymentSystem */
/*global PaymentWindow*/
/*

    This modal has 'persistent state' - so that if it's closed during a payment (when the user is
    supposed to be using the popup window) then when it's reopened it shows the same information.

*/
(function (angular, _) {

    function Money() {}

    Money.prototype = {
        toMajorUnit: function toMajorUnit()
        {
            return (this.minorAmount * this._toMajorUnit).toFixed(this.currency.minorUnitPrecision);
        },

        multiply: function multiplyFn(amount)
        {
            return Money.create(this.currency, this.minorAmount * amount);
        },

        add: function addFn(money)
        {
            var c1 = this.currency,
                c2 = money.currency;

            if (c1.alphabeticCode !== c2.alphabeticCode || c1.minorUnitPrecision !== c2.minorUnitPrecision)
            {
                throw new Error('Can not add Money quantities of different currencies');
            }
            return Money.create(c1, this.minorAmount + money.minorAmount);
        }
    };

    Money.create = function moneyCreateFn(currency, minorAmount) {
        var money = new Money();

        money._toMinorUnit = Math.pow(10, currency.minorUnitPrecision);
        money._toMajorUnit = Math.pow(10, -currency.minorUnitPrecision);

        money.currency = currency;

        money.minorAmount = minorAmount;

        return money;
    };


    var app = angular.module('game.host');


    /*
     Basket Controller

     Shows the user items they are interested in buying, and the total price.
     Allows the user to remove any items they don't want.
     The user can select a payment method (currently Amazon, Paypal or Google Wallet)
     Actual payment processing can be started.

    */
    app.controller('BasketController',
        function ($scope, $http, $q, $timeout, $log, baseUrl, bridge, message, tzModals, config, gameTitle, storeService, slug, chrome) {

        $scope.$id += "-basket";

        $scope.gameTitle = gameTitle;

        $scope.total = 0;
        $scope.currency = {};
        $scope.basketItems = [];

        $scope.payment = {};
        $scope.payment.provider = '';
        $scope.paymentStatus = 'NotStarted';

        $scope.storeService = storeService;

        $scope.storeMeta = {};
        $scope.providers = {};
        $scope.providerNames = {
            paypal: "PAYPAL",
            amazon: "AMAZON",
            googlewallet: "GOOGLE WALLET",
            facebook: "FACEBOOK"
        };


        config.get().then(function (cfg) {

            if (config.facebookAppSlug)
            {
                $scope.payment.provider = 'facebook';
                return;
            }

            if (cfg.payment_provider_googlewallet && cfg.payment_provider_googlewallet.enabled)
            {
                $scope.providers.googlewallet = true;
                $scope.payment.provider = 'googlewallet';
            }
            if (cfg.payment_provider_amazon && cfg.payment_provider_amazon.enabled)
            {
                $scope.providers.amazon = true;
                $scope.payment.provider = 'amazon';
            }
            if (cfg.payment_provider_paypal && cfg.payment_provider_paypal.enabled)
            {
                $scope.providers.paypal = true;
                $scope.payment.provider = 'paypal';
            }

        });

        $scope.onShowModal = function () {

            if ($scope.paymentStatus === 'Complete' ||
                $scope.paymentStatus === 'Failed')
            {
                $scope.paymentStatus = 'NotStarted';
            }
            $scope.show = true; // show the basket
            if (config.facebookAppSlug)
            {
                $scope.buy();
            }

        };

        $scope.closeBasket = function () {
            $scope.show = false;
        };

        $scope.onBeforeClose = function () {
            storeService.resetBasket();
            if ($scope.paymentStatus !== 'Complete')
            {
                storeService.rejectPurchase();
            }
            $scope.paymentStatus = 'NotStarted';
            return {close: true};
        };

        $scope.removeItem = function (index) {
            var item = $scope.basketItems[index];
            if (item)
            {
                storeService.removeBasketItem(item.key);
            }
            $scope.paymentStatus = 'NotStarted';    // when removing an item from a 'Failed' basket.
        };

        tzModals.register('basket', $scope);

        $scope.$watch('storeService.basketContents', function (basketContents) {

            var currency = $scope.currency = basketContents.currency;
            $scope.totalPrice = $scope.currency.htmlCode + Money.create($scope.currency, basketContents.total).toMajorUnit();

            storeService.getStoreMeta().then(function (storeMeta) {
                $scope.basketItems = _.map(basketContents.items, function (item, key) {
                    var meta = storeMeta.offerings[key];

                    return {
                        key: key,
                        amount: item.amount,
                        displayPrice: currency.htmlCode + Money.create(currency, item.price).toMajorUnit(),
                        lineTotal: currency.htmlCode + Money.create(currency, item.lineTotal).toMajorUnit(),

                        title: meta.title,
                        description: meta.description,
                        images: meta.images
                    };
                });
            });
        });


        var unbindwatch;
        var monitorWindow = function (paymentWindow) {

            if (unbindwatch)
            {
                unbindwatch();
            }
            var deferred = $q.defer();

            $timeout(paymentWindow.update, 1000);

            $scope.paymentWindow = paymentWindow;

            unbindwatch = $scope.$watch('paymentWindow.paymentState', function (newValue)
            {
                if (newValue === 'DONE')
                {
                    unbindwatch();
                    $scope.paymentStatus = 'Complete';
                    deferred.resolve();
                }
                else if (newValue === 'FAILED' || newValue === 'PROBABLY_FAILED')
                {
                    unbindwatch();
                    $scope.paymentStatus = 'Failed';
                    $scope.paymentError = paymentWindow.paymentError;
                    deferred.reject(newValue);
                }
            });

            return deferred.promise;
        };


        $scope.buy = function () {

            function fail(msg)
            {
                window.console.error(msg);
            }

            if (!$scope.basketItems)
            {
                fail('Could not process basket items');
                return;
            }

            var basketData = _.reduce($scope.storeService.basketContents.items, function (dict, item, key) {
                dict[key] = {
                    amount: item.amount,
                    price: item.price,
                    output: item.output
                };
                return dict;
            }, {});

            if (_.isEmpty(basketData))
            {
                fail('Basket is Empty');
                return;
            }


            // Open a payment window.
            var paymentWindow = new PaymentWindow(chrome, $timeout, baseUrl);

            paymentWindow.open(function (paymentWindow) {

                monitorWindow(paymentWindow)
                    .then(function () {
                        $log.info('payment successful');
                        storeService.confirmPurchase();
                    })
                    .catch(function () {
                        $log.error($scope.paymentStatus, ':', $scope.paymentError);
                    })
                    .finally(paymentWindow.close);

                $scope.paymentStatus = 'InProgress';
                $scope.paymentError = '';

                $http.post('/api/v1/store/transactions/checkout', {
                    gameSlug: slug,
                    basket: angular.toJson(basketData),
                    paymentProvider: $scope.payment.provider
                }).then(function (response) {

                    var paymentUrl = response &&
                                     response.data &&
                                     response.data.data &&
                                     response.data.data.paymentData &&
                                     response.data.data.paymentData.paymentUrl;

                    if (!paymentUrl)
                    {
                        $scope.paymentStatus = 'Failed';
                        $scope.paymentError = 'OPEN_WINDOW_FAILED';
                    }
                    else if (!paymentWindow.redirect(paymentUrl))
                    {
                        // Can't redirect window
                        $scope.paymentStatus = 'Failed';
                        $scope.paymentError = paymentWindow.paymentError;
                    }

                }).catch(function () {
                    $log.error(arguments);
                });

            });

        };

    });

}(window.angular, window._));
