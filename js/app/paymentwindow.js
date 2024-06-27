'use strict';
/*exported PaymentWindow */
/*
    Payment Window management
*/
function PaymentWindow(chrome, $timeout, baseUrl)
{
    var popupWindow;
    var that = this;

    this.paymentState = 'INITIALISED';
    this.paymentError = '';

    this.getError = function () {
        return this.paymentError;
    };

    // Open the window - shows a spinning redirection message...
    this.open = function (callback) {

        chrome.app.window.create('js/app/paymentwindow.html', {
            bounds: {
                left: 0,
                top: 0,
                width: 932,
                height: 974
            },
            frame: "chrome"
        }, function (newChromeWindow) {

            if (newChromeWindow)
            {
                that.paymentState = 'OPENED';
                popupWindow = newChromeWindow;

                newChromeWindow.contentWindow.addEventListener('load', function () {
                    that.redirect(baseUrl + '/payments/redirect.html');
                    if (callback)
                    {
                        callback(that);
                    }
                });
            }
            else
            {
                that.paymentError = 'Open window failed';
                that.paymentState = 'FAILED';
            }


        });

    };

    this.close = function () {
        popupWindow.close();
    };

    // Redirect the window to the payment provider URL
    this.redirect = function (url) {

        that.paymentError = '';
        this.paymentState = 'POLLING';

        if (!popupWindow || popupWindow.contentWindow.closed)
        {
            that.paymentState = 'FAILED';
            that.paymentError = 'Window closed before redirect';
            return false;
        }

        popupWindow.contentWindow.document.querySelector('webview').src = url;
        return true;

    };


    this._getStatus = function (callback) {

        var contentWindow = popupWindow.contentWindow;

        if (!contentWindow || contentWindow.closed)
        {
            callback({status: 'closed'});
        }
        else
        {
            var webview = contentWindow.document.querySelector('webview');

            webview.executeScript({
                code: "try { x = document.getElementById('popUpTransactionStatus').innerHTML } catch (e) {};"
            }, function (statuses) {

                var state;
                try
                {
                    state = JSON.parse(statuses[0]);
                }
                catch (e) {}

                callback(state || {});

            });
        }

    };


    // Update - progress the payment stages
    this.update = function () {

        that._getStatus(function (status) {

            switch (status.status)
            {
            case 'paying':
                that.paymentState = 'PROCESSING_PAYMENT';
                break;
            case 'payComplete':
                if (status.response && !status.response.ok)
                {
                    that.paymentState = 'FAILED';
                    that.paymentError = status.response.msg || '';
                }
                else
                {
                    that.paymentState = 'DONE';
                }
                break;
            case 'cancelled':
                that.paymentState = 'FAILED';
                that.paymentError = 'Cancelled';
                break;
            case 'closed':
                that.paymentState = 'PROBABLY_FAILED';
                that.paymentError = 'Window closed during paying';
                break;
            }

        });

        // Keep polling until finished.
        if (that.paymentState !== 'DONE' &&
            that.paymentState !== 'FAILED' &&
            that.paymentState !== 'PROBABLY_FAILED')
        {
            $timeout(that.update, 500);
        }

    };
}


