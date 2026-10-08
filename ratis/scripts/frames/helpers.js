"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

/**
 * Shared helpers for the Ratis frames. Same idioms as the /raft frames,
 * plus helpers for showing the `ratis sh` command or client API call that
 * drives each step.
 */
define([], function () {
    return function (frame) {
        var h = {},
            player = frame.player(),
            layout = frame.layout();

        h.PEERS = "n0:9872,n1:9872,n2:9872";

        h.model = function () { return frame.model(); };
        h.node = function (id) { return frame.model().nodes.find(id); };
        h.client = function (id) { return frame.model().clients.find(id); };
        h.cluster = function (value) {
            h.model().nodes.toArray().forEach(function (node) { node.cluster(value); });
        };

        // Pause until "Continue" is clicked (live frames).
        h.wait = function () { var self = this; h.model().controls.show(function () { self.stop(); }); };

        // Pause until "Continue" is clicked (scripted frames that take snapshots).
        h.step = function () { var self = this; h.model().controls.show(function () { player.play(); self.stop(); }); };

        h.subtitle = function (s, pause) {
            h.model().subtitle = s + h.model().controls.html();
            layout.invalidate();
            if (pause === undefined) {
                h.model().controls.show();
            }
        };
        h.clear = function () { h.subtitle("", false); };

        // A shell command callout.
        h.cmd = function (s) {
            return '<pre class="cmd">$ ' + s + '</pre>';
        };

        // A Java API / config callout.
        h.api = function (s) {
            return '<pre class="api">' + s + '</pre>';
        };

        // Runs a timer until cond() is true, polling. Avoids races where the
        // awaited event may already have happened.
        h.until = function (cond) {
            return function () {
                var self = this,
                    check = function () {
                        if (cond()) {
                            self.stop();
                        } else {
                            frame.after(h.model().defaultNetworkLatency / 4, check);
                        }
                    };
                frame.after(1, check);
            };
        };

        // The operator running `ratis sh`.
        h.createOperator = function () {
            var op = h.model().clients.create("sh");
            op.value("sh");
            op.color = "#555";
            return op;
        };

        // An admin API round trip from the operator to a peer.
        h.admin = function (target, onArrive, onReply) {
            var op = h.client("sh");
            h.model().send(op, target, {type: "ADMIN"}, function () {
                if (onArrive) {
                    onArrive();
                }
                h.model().send(target, op, {type: "ADMIN"}, onReply);
                layout.invalidate();
            });
        };

        // Draws a partition line that cuts one node off from the rest.
        h.isolate = function (id) {
            var nodes = h.model().nodes.toArray(),
                sx = layout.scales.x,
                sy = layout.scales.y,
                t = h.node(id),
                cx = 0,
                cy = 0,
                tx,
                ty,
                mx,
                my,
                p = h.model().partitions.create("isolate-" + id);
            nodes.forEach(function (n) { cx += sx(n.x) / nodes.length; cy += sy(n.y) / nodes.length; });
            tx = sx(t.x) - cx;
            ty = sy(t.y) - cy;
            mx = cx + tx * 0.5;
            my = cy + ty * 0.5;
            p.x1 = sx.invert(mx + ty * 0.8);
            p.y1 = sy.invert(my - tx * 0.8);
            p.x2 = sx.invert(mx - ty * 0.8);
            p.y2 = sy.invert(my + tx * 0.8);
            h.model().nodes.toArray().forEach(function (n) {
                if (n.id !== id) {
                    h.model().latency(id, n.id, 0);
                }
            });
            layout.invalidate();
        };

        h.title = function (s) {
            h.model().title = '<h2 style="visibility:visible">' + s + '</h2>'
                + '<br/>' + h.model().controls.html();
            layout.invalidate();
        };

        return h;
    };
});
