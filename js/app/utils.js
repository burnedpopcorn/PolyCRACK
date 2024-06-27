'use strict';
(function (angular, _)
{
    // Add string formatting
    String.prototype.format = function ()
    {
        var args = arguments;
        if (args.length === 1 && (angular.isArray(args[0]) || angular.isObject(args[0])))
        {
            args = args[0];
        }
        return this.replace(/\{(\w+)\}/g, function (match, key)
        {
            return typeof args[key] === 'undefined' ? match : args[key];
        });
    };
    // Add endswith
    if (typeof String.prototype.endsWith !== 'function')
    {
        String.prototype.endsWith = function (str)
        {
            return this.indexOf(str, this.length - str.length) > -1;
        };
    }


    var app = angular.module('game.host');

    app.service('utilities', [function ()
    {

        // UNTESTED!!
        // This function creates an auto-updating watch on a scope that will change when the attribute value updates
        this.observeOnScope = function (name, attributes, scope, callback, deepWatch)
        {
            var watch;
            var lastValue;
            var haslastValue = false;

            // When the attribute changes create a new watch
            attributes.$observe(name, function (value)
            {
                // If we have an existing watch, destroy it
                if (watch)
                {
                    watch();
                }

                watch = scope.$watch(value, function (newValue, oldValue)
                {
                    // If initialising a new watch and we have an old value from a previous watch, then use the old
                    // value to trigger a watch as if the value had changed.
                    if ((newValue === oldValue) && haslastValue)
                    {
                        if (newValue !== lastValue || !(deepWatch && angular.equals(lastValue, oldValue)))
                        {
                            callback(newValue, lastValue);
                        }
                    }
                    else
                    {
                        callback(newValue, oldValue);
                    }
                    lastValue = newValue;
                    haslastValue = true;
                }, deepWatch);
            });
        };
        // UNTESTED!!


        // Whoda thunk it - modulo operator is broken...
        this.floorModulo = function moduloFn(dividend, divisor)
        {
            return dividend - (divisor * Math.floor(dividend / divisor));
        };

        var Base64ConversionTable = {};
        (function (table)
        {
            var tableStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=";
            for (var n = 0; n < 65; n += 1)
            {
                table[tableStr.charAt(n)] = n;
            }
        }(Base64ConversionTable));

        this.compareBase64 = function (a, b)
        {
            var aLength = a.length;
            var bLength = b.length;
            var minLength = (aLength < bLength ? aLength : bLength);
            var n = 0;
            do
            {
                var aC = a.charAt(n);
                var bC = b.charAt(n);
                if (aC !== bC)
                {
                    var table = Base64ConversionTable;
                    return (table[aC] > table[bC] ? 1 : -1);
                }
                n += 1;
            }
            while (n < minLength);
            return (aLength > bLength ? 1 : -1);
        };

        this.decodeBytesBase64 = function (input)
        {
            var table = Base64ConversionTable;
            var inputLength = input.length;
            var bytes, i, b, enc1, enc2, enc3, enc4;

            i = (inputLength % 4);
            if (i)
            {
                // Need to pad with '='
                i = (4 - i);
                do
                {
                    input += '=';
                    inputLength += 1;
                    i -= 1;
                }
                while (i);
            }

            bytes = [];
            bytes.length = (inputLength / 4) * 3;
            i = 0;
            b = 0;
            do
            {
                enc1 = table[input.charAt(i)];
                enc2 = table[input.charAt(i + 1)];
                enc3 = table[input.charAt(i + 2)];
                enc4 = table[input.charAt(i + 3)];

                /*jshint bitwise: false*/
                bytes[b] = ((enc1 << 2) | (enc2 >> 4));
                if (enc3 !== 64)
                {
                    bytes[b + 1] = (((enc2 & 15) << 4) | (enc3 >> 2));
                    if (enc4 !== 64)
                    {
                        bytes[b + 2] = (((enc3 & 3) << 6) | enc4);
                    }
                    else
                    {
                        bytes.length = (b + 2);
                        break;
                    }
                }
                else
                {
                    bytes.length = (b + 1);
                    break;
                }
                /*jshint bitwise: true*/
                b += 3;
                i += 4;
            }
            while (i < inputLength);

            return bytes;
        };

        /*jshint bitwise: false*/
        this.decodeTimestampBytes = function (bytes)
        {
            return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]);
        };
        /*jshint bitwise: true*/

        this.decodeTimestampBase64 = function (input)
        {
            var bytes = this.decodeBytesBase64(input);
            return this.decodeTimestampBytes(bytes);
        };

        this.decodeStringBytes = function (bytes)
        {
            var numBytes = bytes.length, n = 0;
            do
            {
                // Convert byte values to strings, padding with leading zeros so it can be sorted
                bytes[n] = ('00' + bytes[n]).slice(-3);
                n += 1;
            }
            while (n < numBytes);
            return bytes.join('');
        };

        this.decodeComplementStringBytes = function (bytes)
        {
            var numBytes = bytes.length, n = 0;
            do
            {
                // Convert byte values to strings, padding with leading zeros so it can be sorted
                bytes[n] = ('00' + (255 - bytes[n])).slice(-3);
                n += 1;
            }
            while (n < numBytes);
            return bytes.join('');
        };

        this.getUrl = function (object)
        {
            if (!(object && object.url))
            {
                return null;
            }
            return _.isFunction(object.url) ? object.url() : object.url;
        };

        this.getFormattedDeltaTimestamp = function (oldTimestamp, newTimestamp, extendedFormat)
        {
            var seconds = (newTimestamp - oldTimestamp);
            var minute = 60;
            var hour = (60 * 60);
            var day = (60 * 60 * 24);
            var week = (60 * 60 * 24 * 7);
            var month = (60 * 60 * 24 * 30);
            var year = (60 * 60 * 24 * 30 * 12);

            if (seconds >= year)
            {
                var numYears = (seconds / year);
                if (numYears >= 2)
                {
                    return extendedFormat ? numYears.toFixed() + " years ago" : numYears.toFixed() + " yrs";
                }
                else
                {
                    return extendedFormat ? "1 year ago" : "1 yr";
                }
            }
            else if (seconds >= month)
            {
                var numMonths = (seconds / month);
                if (numMonths >= 2)
                {
                    return extendedFormat ? numMonths.toFixed() + " months ago" : numMonths.toFixed() + " mths";
                }
                else
                {
                    return extendedFormat ? "1 month ago" : "1 mth";
                }
            }
            else if (seconds >= week)
            {
                var numWeeks = (seconds / week);
                if (numWeeks >= 2)
                {
                    return extendedFormat ? numWeeks.toFixed() + " weeks ago" : numWeeks.toFixed() + " wks";
                }
                else
                {
                    return extendedFormat ? "1 week ago" : "1 wk";
                }
            }
            else if (seconds >= day)
            {
                var numDays = (seconds / day);
                if (numDays >= 2)
                {
                    return extendedFormat ? numDays.toFixed() + " days ago" : numDays.toFixed() + " days";
                }
                else
                {
                    return extendedFormat ? "1 day ago" : "1 day";
                }
            }
            else if (seconds >= hour)
            {
                var numHours = (seconds / hour);
                if (numHours >= 2)
                {
                    return extendedFormat ? numHours.toFixed() + " hours ago" : numHours.toFixed() + " hrs";
                }
                else
                {
                    return extendedFormat ? "1 hour ago" : "1 hr";
                }
            }
            else if (seconds >= minute)
            {
                var numMinutes = (seconds / minute);
                if (numMinutes >= 2)
                {
                    return extendedFormat ? numMinutes.toFixed() + " minutes ago" : numMinutes.toFixed() + " mins";
                }
                else
                {
                    return extendedFormat ? "1 minute ago" : "1 min";
                }
            }
            else
            {
                if (seconds >= 2)
                {
                    return extendedFormat ? seconds.toFixed() + " seconds ago" : seconds.toFixed() + " secs";
                }
                else
                {
                    return extendedFormat ? "1 second ago" : "1 sec";
                }
            }
        };

        this.getOrdinal = function (n)
        {
            var s = ["th", "st", "nd", "rd"];
            var v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        this.truncate = function (text, maxchars, placeholder)
        {
            placeholder = placeholder || '...';
            return text.length > maxchars ? text.substring(0, maxchars - placeholder.length) + placeholder : text;
        };

        this.currentTimeInSeconds = function ()
        {
            return Math.round((new Date()).getTime() / 1000);
        };

        // Parses the parameter into query string format
        // Precondition: parameter is assumed to be a javascript object.
        // The returned queryString will NOT begin with a '?'
        this.toQueryString = function (object)
        {
            var queryString = '';
            var value;
            for (var attr in object)
            {
                if (object.hasOwnProperty(attr))
                {
                    value = object[attr];
                    if (_.isObject(value) || _.isArray(value))
                    {
                        // We do not nest the query string, so any non-primitive is stringified
                        value = JSON.stringify(value);
                    }
                    queryString += encodeURIComponent(attr) + '=' +
                        encodeURIComponent(value) + '&';
                }
            }
            if (queryString.length > 0)
            {
                // Remove the final '&'
                queryString = queryString.slice(0, -1);
            }
            return queryString;
        };

        this.delegate = function ()
        {
            var registered = [];

            var delegate = function ()
            {
                var args = arguments;
                _.forEach(registered, function (fn)
                {
                    fn.apply(undefined, args);
                });
            };

            delegate.add = function (fn)
            {
                registered.push(fn);
                return function () {
                    delegate.remove(fn);
                };
            };

            delegate.remove = function (fn)
            {
                registered = _.without(registered, fn);
            };

            return delegate;
        };

    }]);

    app.directive('tzAnimationFinished', ['$timeout', function ($timeout)
    {
        return {
            restrict: 'A',
            link: function (scope, element, attributes)
            {
                var oldWatch = angular.noop;

                var testAnimation = function (options, trycount)
                {
                    if (trycount)
                    {
                        if (!element.hasClass(options.animation))
                        {
                            options.callback();
                        }
                        else
                        {
                            $timeout(function ()
                            {
                                testAnimation(options, trycount - 1);
                            }, 50);
                        }
                    }
                    else
                    {
                        options.callback();
                    }
                };

                scope.$watch(attributes.tzAnimationFinished, function (unsafeOptions)
                {
                    var options = _.extend({
                        animation: 'animation-hide',
                        delay: 0,
                        callback: angular.noop
                    }, unsafeOptions);

                    // Clean up previous watch
                    oldWatch();

                    if (options.trigger)
                    {
                        oldWatch = scope.$watch(options.trigger, function (trigger)
                        {
                            if (trigger)
                            {
                                $timeout(function ()
                                {
                                    testAnimation(options, 20);
                                }, options.delay);
                            }
                        });
                    }
                    else
                    {
                        oldWatch = angular.noop;
                    }

                });
            }
        };
    }]);

})(window.angular, window._);
