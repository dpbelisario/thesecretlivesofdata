"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

/**
 * Shared helpers for the RocksDB frames. Every frame is scripted: each step
 * takes a snapshot (so "replay" works), animates, then waits for Continue.
 */
define([], function () {
    return function (frame) {
        var h = {},
            player = frame.player(),
            layout = frame.layout();

        h.DB = "/data/db";

        h.model = function () { return frame.model(); };
        h.db = function () { return frame.model().db; };
        h.client = function (id) { return frame.model().clients.find(id); };
        h.redraw = function () { layout.invalidate(); };

        h.step = function () { var self = this; h.model().controls.show(function () { player.play(); self.stop(); }); };

        h.say = function (s) {
            frame.snapshot();
            h.model().subtitle = s + h.model().controls.html();
            layout.invalidate();
        };

        h.cmd = function (s) { return '<pre class="cmd">$ ' + s + '</pre>'; };
        h.api = function (s) { return '<pre class="api">' + s + '</pre>'; };

        h.title = function (s) {
            h.model().title = '<h2 style="visibility:visible">' + s + '</h2>'
                + '<br/>' + h.model().controls.html();
            layout.invalidate();
        };

        h.app = function () {
            var c = h.model().clients.create("app");
            c.value("app");
            c.caption = "your service";
            return c;
        };

        h.ldb = function () {
            var c = h.model().clients.create("ldb");
            c.value("ldb");
            c.color = "#555";
            c.caption = "operator";
            return c;
        };

        h.clearHighlights = function () {
            h.model().highlights = {};
            h.model().badges = {};
        };

        h.highlight = function (ids, kind, badge) {
            ids.forEach(function (id) {
                h.model().highlights[id] = kind;
                if (badge !== undefined) {
                    h.model().badges[id] = badge;
                }
            });
            layout.invalidate();
        };

        /**
         * Animated put: the record goes to the WAL first, then the MemTable.
         */
        h.put = function (from, k, v, done) {
            var m = h.model();
            m.send(from, "lbl-wal", {type: "PUT"}, function () {
                var entry;
                m.db.seq += 1;
                m.walRecord(v === null ? "del " + k : "put " + k + "=" + v);
                entry = (v === null ? {k: k, del: true, seq: m.db.seq} : {k: k, v: v, seq: m.db.seq});
                layout.invalidate();
                m.send("wal-" + entry.seq, m.db.mem.id, {type: "PUT"}, function () {
                    m.memInsert(entry);
                    layout.invalidate();
                    if (done) {
                        done();
                    }
                }, m.defaultNetworkLatency * 0.7);
                layout.invalidate();
            });
            layout.invalidate();
        };

        /**
         * Instant puts, used to set up a scene.
         */
        h.load = function (pairs) {
            pairs.forEach(function (p) {
                if (p[1] === null) {
                    h.model().del(p[0]);
                } else {
                    h.model().put(p[0], p[1]);
                }
            });
        };

        /**
         * Animated flush of the oldest immutable MemTable into L0.
         */
        h.flush = function (done) {
            var m = h.model(), imm = m.db.imm[m.db.imm.length - 1];
            if (!imm) {
                return;
            }
            m.send(imm.id, "lbl-L0", {type: "FLUSH"}, function () {
                var sst = m.flush();
                h.clearHighlights();
                h.highlight([sst.id], "new");
                if (done) {
                    done(sst);
                }
            });
            layout.invalidate();
        };

        /**
         * Animated compaction of `level` into `level + 1`.
         */
        h.compact = function (level, done) {
            var m = h.model(),
                inputs = m.compactionInputs(level);
            inputs.forEach(function (f) {
                m.send(f.id, "lbl-L" + (level + 1), {type: "COMPACT"});
            });
            frame.after(m.defaultNetworkLatency, function () {
                var out = m.compact(level);
                h.clearHighlights();
                h.highlight(out.map(function (f) { return f.id; }), "new");
                if (done) {
                    done(out);
                }
            });
            layout.invalidate();
        };

        /**
         * Animated Get: visits each place the key could be, newest first.
         */
        h.get = function (from, k, maxSeq, done) {
            var m = h.model(),
                steps = m.planGet(k, maxSeq),
                gap = m.defaultNetworkLatency * 0.9,
                badge = {hit: "found", "found-del": "tombstone", miss: "not here", bloom: "bloom: no"};
            h.clearHighlights();
            steps.forEach(function (s, i) {
                frame.after(gap * i, function () {
                    m.send(i === 0 ? from : steps[i - 1].id, s.id, {type: "GET"}, null, gap * 0.8);
                    layout.invalidate();
                });
                frame.after(gap * i + gap * 0.8, function () {
                    h.highlight([s.id], s.result, badge[s.result]);
                });
            });
            frame.after(gap * steps.length, function () {
                var last = steps[steps.length - 1];
                m.send(last.id, from, {type: "RESULT"}, function () {
                    if (done) {
                        done(last);
                    }
                }, gap);
                layout.invalidate();
            });
            return steps;
        };

        return h;
    };
});
