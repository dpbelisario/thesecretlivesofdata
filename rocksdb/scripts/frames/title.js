"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define([], function () {
    return function (frame) {
        var player = frame.player(),
            layout = frame.layout();

        frame.after(1, function () {
            frame.model().clear();
            layout.invalidate();
        })

        .after(500, function () {
            frame.model().title = '<h1 style="visibility:visible">RocksDB</h1>'
                        + '<h2 style="visibility:visible">An LSM-tree storage engine, and the commands that inspect it</h2>'
                        + '<h3 style="visibility:visible">Part 2 of 2 &middot; Part 1: <a href="../ratis/">Apache Ratis</a></h3>'
                        + '<br/>' + frame.model().controls.html();
            layout.invalidate();
        })
        .after(500, function () {
            frame.model().subtitle = '<p style="visibility:visible"><em>Ratis decides the order of writes. RocksDB is often where they end up on disk.</em></p>';
            layout.invalidate();
            frame.model().controls.show();
        })

        .after(100, function () {
            player.next();
        });

        player.play();
    };
});
