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
            // How long an animated Get over n places takes.
            show = function (n) {
                return latency(0.9) * (n + 1) + 200;
            },
            app = function (v) { h.client("app").value(v); h.redraw(); };

        frame.after(1, function () {
            m().clear();
            h.redraw();
        })
        .after(500, function () {
            h.title("The Read Path &amp; Bloom Filters");
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            m().title = "";
            // L1: two non-overlapping files.
            h.load([["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ["f", "6"]]);
            m().switchMemtable();
            m().flush();
            m().compact(0);
            // L0: two overlapping files.
            h.load([["b", null], ["g", "8"]]);
            m().switchMemtable();
            m().flush();
            h.load([["a", "9"], ["h", "1"]]);
            m().switchMemtable();
            m().flush();
            // MemTable.
            h.load([["j", "3"]]);
            h.app();
            h.ldb();
            h.say('<h2>Data for a key can be anywhere: the MemTable, an immutable MemTable, any L0 file, or one file per deeper level.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Get from MemTable
        //------------------------------
        .after(100, function () {
            h.say('<h2>A Get checks the newest data first and stops at the first match. Key <code>j</code> was written recently...</h2>'
                + h.api('std::string value;\nStatus s = db->Get(ReadOptions(), "j", &value);'));
            h.get("app", "j", null, function (r) { app(r.entry.v); });
        })
        .after(show(1), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...so it\'s found in the MemTable. No disk access at all.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Get through the levels
        //------------------------------
        .after(100, function () {
            app("");
            h.say('<h2>Now key <code>e</code>, written long ago. Not in the MemTable, so on to L0. Both L0 files\' ranges include <code>e</code>, so both must be checked...</h2>');
            h.get("app", "e", null, function (r) { app(r.entry.v); });
        })
        .after(show(4), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...but each SST has a <em>Bloom filter</em> that says "definitely not here", so neither file is read. In L1 only one file covers <code>e</code>, and there it is.</h2>'
                + h.api('BlockBasedTableOptions t;\nt.filter_policy.reset(NewBloomFilterPolicy(10));   // ~1% false positives\nt.block_cache = NewLRUCache(512 << 20);           // hot blocks stay in memory'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Tombstone
        //------------------------------
        .after(100, function () {
            app("");
            h.say('<h2>Key <code>b</code> was deleted. The newest L0 file has nothing, the next one has b\'s tombstone...</h2>');
            h.get("app", "b", null, function () { app("-"); });
        })
        .after(show(3), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...so the answer is "not found", even though <code>b=2</code> still sits in L1. The tombstone hides it until compaction removes both.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' get b\nKey not found'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Snapshot
        //------------------------------
        .after(100, function () {
            app("");
            h.clearHighlights();
            db().snapshot = db().seq;
            h.say('<h2>A <em>snapshot</em> pins a sequence number. Reads through it ignore anything written later.</h2>'
                + h.api('const Snapshot* snap = db->GetSnapshot();\nReadOptions ro;\nro.snapshot = snap;'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Now overwrite <code>e</code>...</h2>');
            h.put("app", "e", "99");
        })
        .after(latency(1.8), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...and read <code>e</code> through the snapshot. The new <code>e=99</code> is newer than the snapshot, so it\'s skipped and the old value 5 comes back.</h2>');
            h.get("app", "e", db().snapshot, function (r) { app(r.entry.v); });
        })
        .after(show(4), h.step).indefinite()
        .after(100, function () {
            h.clearHighlights();
            db().snapshot = null;
            h.say('<h2>While a snapshot is held, compaction must keep the older versions it can see. Release it when you\'re done.</h2>'
                + h.api('db->ReleaseSnapshot(snap);'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Scans
        //------------------------------
        .after(100, function () {
            app("");
            h.say('<h2>Range scans use an iterator that merges every MemTable and level in key order. That\'s what <code>ldb scan</code> does:</h2>'
                + h.cmd('ldb --db=' + h.DB + ' scan --from=a --to=f\na ==> 9\nc ==> 3\nd ==> 4\ne ==> 99'));
        })
        .after(300, function () {
            m().send("ldb", db().mem.id, {type: "ADMIN"}, function () {
                m().send(db().mem.id, "ldb", {type: "ADMIN"});
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
