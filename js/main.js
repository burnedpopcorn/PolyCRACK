// Copyright (c) 2013 Turbulenz Limited
var MainWindow;

chrome.app.runtime.onLaunched.addListener(function () {

    chrome.app.window.create('index.html', {
        minWidth: 790,
        minHeight: 444,
        bounds: {
            left: 0,
            top: 0,
            width: 1280,
            height: 720
        },
        id: 'polycraft',
        frame: "chrome"
    },
    function (win) {
        MainWindow = win;
    });
});

chrome.runtime.onSuspend.addListener(function () {
    // Clean-up tasks.
    MainWindow.contentWindow.postMessage('TurbulenzEngine.onunload', '*');
});

