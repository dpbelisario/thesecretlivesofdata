"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./helpers"], function (helpers) {
    return function (frame) {
        var player = frame.player(),
            h = helpers(frame),
            m = h.model,
            db = h.db,
            latency = function (n) { return m().defaultNetworkLatency * n; },
            flushNow = function (pairs) {
                h.load(pairs);
                m().switchMemtable();
                m().flush();
            };

        frame.after(1, function () {
            m().clear();
            h.redraw();
        })
        .after(500, function () {
            h.title("Compaction");
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            m().title = "";
            flushNow([["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ["f", "6"]]);
            m().compact(0);
            flushNow([["a", "10"], ["b", null]]);
            flushNow([["c", "11"], ["g", "7"]]);
            flushNow([["e", "12"], ["h", "8"]]);
            h.app();
            h.ldb();
            h.say('<h2>Every L0 file is one more place each read may have to check, so RocksDB limits how many can pile up.</h2>'
                + h.api('options.level0_file_num_compaction_trigger = 4;   // default'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>One more flush makes four L0 files...</h2>');
            h.load([["a", null], ["i", "9"]]);
            m().switchMemtable();
            h.flush();
        })
        .after(latency(1.2), h.step).indefinite()

        //------------------------------
        // L0 -> L1
        //------------------------------
        .after(100, function () {
            h.clearHighlights();
            h.highlight(m().compactionInputs(0).map(function (f) { return f.id; }), "input");
            h.say('<h2>...which triggers a compaction. It takes <strong>all</strong> the L0 files (they overlap) plus every L1 file whose key range overlaps them.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>It merge-sorts them, keeps only the newest version of each key, and drops tombstones (a, b) that have nothing older left to hide...</h2>');
            h.compact(0);
        })
        .after(latency(1.2), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...then writes new L1 files whose ranges don\'t overlap, and deletes the inputs. Reads now check at most one L1 file per key.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // L1 -> L2
        //------------------------------
        .after(100, function () {
            h.clearHighlights();
            h.say('<h2>Each level has a size target about 10&times; the one above it, so most data ends up in the last level.</h2>'
                + h.api('options.max_bytes_for_level_base = 256 << 20;   // L1 target: 256 MB (default)\noptions.max_bytes_for_level_multiplier = 10;    // L2 2.5 GB, L3 25 GB, ...'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.highlight(m().compactionInputs(1).map(function (f) { return f.id; }), "input");
            h.say('<h2>When L1 goes over its target, one L1 file at a time is merged with the overlapping L2 files, the same way.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>The merged file is written to L2 and the input is deleted. Older data drifts down, level by level.</h2>');
            h.compact(1);
        })
        .after(latency(1.2), h.step).indefinite()

        //------------------------------
        // Stalls, manual, stats
        //------------------------------
        .after(100, function () {
            h.clearHighlights();
            h.say('<h2>If writes outpace compaction, L0 fills up. RocksDB slows writes down, and eventually stops them, until compaction catches up.</h2>'
                + h.api('options.level0_slowdown_writes_trigger = 20;   // default\noptions.level0_stop_writes_trigger     = 36;   // default'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>You can also compact a key range by hand, for example after deleting lots of data. This needs the LOCK, so stop your service first.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' compact --from=a --to=z') + h.api('db->CompactRange(CompactRangeOptions(), &begin, &end);'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>To see how compaction is keeping up, read the stats: files and size per level, write amplification, stall counts.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' get_property rocksdb.stats\nldb --db=' + h.DB + ' get_property rocksdb.levelstats'));
        })
        .after(300, function () {
            m().send("ldb", "lbl-L1", {type: "ADMIN"}, function () {
                m().send("lbl-L1", "ldb", {type: "ADMIN"});
            });
            h.redraw();
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
