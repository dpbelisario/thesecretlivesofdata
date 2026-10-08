"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define([], function () {
    return function (frame) {
        var player = frame.player(),
            layout = frame.layout();

        frame.after(1, function() {
            frame.model().clear();
            layout.invalidate();
        })

        .after(500, function () {
            frame.model().title = '<h1 style="visibility:visible">Apache Ratis</h1>'
                        + '<h2 style="visibility:visible">Raft as a Java library, and the commands that drive it</h2>'
                        + '<h3 style="visibility:visible">Part 1 of 2 &middot; Part 2: <a href="../rocksdb/">RocksDB</a></h3>'
                        + '<br/>' + frame.model().controls.html();
            layout.invalidate();
        })
        .after(500, function () {
            frame.model().subtitle = '<p style="visibility:visible"><em>New to Raft? Start with the <a href="../raft/">Raft walkthrough</a>. This one builds on it.</em></p>';
            layout.invalidate();
            frame.model().controls.show();
        })

        .after(100, function () {
            player.next();
        });

        player.play();
    };
});
