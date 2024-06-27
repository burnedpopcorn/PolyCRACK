'use strict';

// Define 'Currency' globally
// (Used by some test code)
function Currency(currency_data)
{
    var htmlCodes = {
        USD: '$',
        GBP: '&pound;',
        EUR: '&euro;',
        JPY: '&yen;'
    };
    // All this data could be 'copied' or 'extended' onto this object in one line,
    // but the idea is to eventually have TypeScript checking, which means all the
    // members have to be explicitly declared like this.
    this.alphabeticCode = currency_data.alphabeticCode;
    this.currencyName = currency_data.currencyName;
    this.id = currency_data.alphabeticCode;
    this.htmlCode = htmlCodes[this.id];
    this.minorUnitPrecision = currency_data.minorUnitPrecision;
    this.numericCode = currency_data.numericCode;
    this.toMinorUnit = Math.pow(10, this.minorUnitPrecision);
    this.toMajorUnit = Math.pow(10, -this.minorUnitPrecision);
}

(function (angular/*, _*/)
{
    var app = angular.module('gamesite.services');

    app.service('currencies', ['$http', '$q', function currenciesServiceFn($http, $q)
    {
        var currencies;
        var deferred;

        this.get = function () {
            if (!deferred)
            {
                deferred = $q.defer();

                $http.get('/api/v1/store/currency-list').then(function (response)
                {
                    var data = response.data;
                    if (data && data.ok)
                    {
/*
alphabeticCode: "USD"
currencyName: "US Dollar"
minorUnitPrecision: 2
numericCode: 840


alphabeticCode: "USD"
currencyName: "US Dollar"
-htmlCode: "&#36;"
-id: "USD"
minorUnitPrecision: 2
numericCode: 840
-toMajorUnit: 0.01
-toMinorUnit: 100
*/
                        currencies = {};
                        for (var currency in data.data)
                        {
                            if (data.data.hasOwnProperty(currency))
                            {
                                currencies[currency] = new Currency(data.data[currency]);
                            }
                        }
                        deferred.resolve(currencies);
                    }
                    else
                    {
                        deferred.reject();
                    }

                }, function ()
                {
                    deferred.reject();
                });
            }

            return deferred.promise;
        };

        this.currencies = currencies;

    }]);

})(window.angular, window._);
