'use strict';
(function (angular)
{
    var module = angular.module('game.host');

    module.service('oauth', ['$q', '$rootScope', '$log', 'chrome',
                              function ($q, $rootScope, $log, chrome)
    {

//        $http.get("https://www.googleapis.com/userinfo/v2/me",
//        {
//            headers: {
//                'Authorization': "Bearer " + token
//            }
//        }).then(function (response)
//        {
//
//        });
        this.signOut = function ()
        {
            chrome.identity.getAuthToken({ 'interactive': false }, function (token)
            {
                if (token)
                {
                    chrome.identity.removeCachedAuthToken({token: token}, angular.noop);
                }
            });
        };

        this.signIn = function ()
        {
            var signedInToGoogle = $q.defer();
            chrome.identity.getAuthToken({ 'interactive': false }, function (token)
            {
                if (chrome.runtime.lastError &&
                    chrome.runtime.lastError.message !== "OAuth2 not granted or revoked.")
                {
                    // Authentication failed.
                    $log.log('Authentication failed');
                    $rootScope.safeApply(function ()
                    {
                        // If we are here we are offline. We do not know who the user is
                        signedInToGoogle.reject(chrome.runtime.lastError);
                    });
                }
                else
                {
                    if (token)
                    {
                        $rootScope.safeApply(function ()
                        {
                            signedInToGoogle.resolve(token);
                        });
                    }
                    else
                    {
                        chrome.identity.getAuthToken({ 'interactive': true }, function (token)
                        {
                            if (chrome.runtime.lastError)
                            {
                                // Authentication failed.
                                $log.log('Authentication rejected');
                                $rootScope.safeApply(function ()
                                {
                                    // If we are here the user may have refused to allow us to
                                    // log in to google
                                    signedInToGoogle.reject(chrome.runtime.lastError);
                                });
                            }
                            else
                            {
                                if (token)
                                {
                                    $rootScope.safeApply(function ()
                                    {
                                        signedInToGoogle.resolve(token);
                                    });
                                }
                                else
                                {
                                    // Authentication failed.
                                    $log.log('Authentication refused');
                                    $rootScope.safeApply(function ()
                                    {
                                        signedInToGoogle.reject('Authentication refused');
                                    });
                                }
                            }

                        });
                    }
                }

            });
            return signedInToGoogle.promise;
        };
    }]);
})(window.angular);
