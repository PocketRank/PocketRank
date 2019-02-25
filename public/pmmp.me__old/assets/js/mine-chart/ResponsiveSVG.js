(function () {
    'use strict';

    function ResponsiveSVG(width, height, baseHeight = 0) {
        this.baseHeight = baseHeight;
        this.aspectRatio = height / width;
        this.listeners = {};
    }

    ResponsiveSVG.prototype.bind = function (base) {
        var that = this;
        if (this.base) throw "Tried to bind to ResponsiveSVG.js this already binded";

        this.base = d3.select(base);

        // update size once
        this.updateSize();

        // register resize handler
        d3.select(window).on("resize", function () {
            that.updateSize();
        });

        // successfully binded!
    }

    ResponsiveSVG.prototype.on = function (eventType, handler) {
        if (eventType in this.listeners) {
            this.listeners[eventType].push(handler);
        } else {
            this.listeners[eventType] = [handler];
        }
    }

    ResponsiveSVG.prototype.emit = function (eventType) {
        if (eventType in this.listeners) {
            for (var i in this.listeners[eventType]) {
                this.listeners[eventType][i]();
            }
        }
    }

    ResponsiveSVG.prototype.updateSize = function () {
        var rect = this.base.node().parentNode.getBoundingClientRect();

        this.base.attr("width", this.width = rect.width);
        this.base.attr("height", this.height = rect.width * this.aspectRatio + this.baseHeight);

        this.emit("resize");
    }

    window.ResponsiveSVG = ResponsiveSVG;
}());