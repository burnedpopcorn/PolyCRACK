// Copyright (c) 2013 Turbulenz Limited
var TurbulenzEngine = {};

// Engine startup
window.onload = function ()
{
    var appEntry = TurbulenzEngine.onload;
    var appShutdown = TurbulenzEngine.onunload;

    var canvas = document.getElementById('turbulenz_game_engine_canvas');

    var startCanvas = function startCanvasFn()
    {
        TurbulenzEngine = WebGLTurbulenzEngine.create({
            canvas: canvas,
            fillParent: true
        });

        TurbulenzEngine.onload = appEntry;
        TurbulenzEngine.onunload = appShutdown;
        appEntry();
    };

    window.addEventListener('message', function (e) {
        if (e.data === 'TurbulenzEngine.onunload')
        {
            if (TurbulenzEngine.onunload)
            {
                TurbulenzEngine.onunload.call(this);
            }
        }
    });

    startCanvas();
};

