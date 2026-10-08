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
            first = null;

        frame.after(1, function () {
            m().clear();
            h.redraw();
        })
        .after(500, function () {
            h.title("Flush: MemTable &rarr; SST file");
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            m().title = "";
            h.load([["a", "5"], ["b", null], ["d", "4"], ["f", "6"]]);
            h.app();
            h.ldb();
            h.say('<h2>A MemTable only grows until it reaches a size limit.</h2>'
                + h.api('options.write_buffer_size = 64 << 20;   // 64 MB, the default'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Let\'s pretend this one is full after one more write.</h2>');
            h.put("app", "c", "9");
        })
        .after(latency(1.8), h.step).indefinite()

        //------------------------------
        // Switch
        //------------------------------
        .after(100, function () {
            m().switchMemtable();
            h.say('<h2>The full MemTable becomes <em>immutable</em> (read-only). A fresh MemTable and a new WAL file take over, so writes never wait.</h2>'
                + h.api('options.max_write_buffer_number = 2;   // MemTables in memory, active + immutable'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>New writes keep landing in the new MemTable while a background thread...</h2>');
            h.put("app", "e", "1");
        })
        .after(latency(1.8), h.step).indefinite()

        //------------------------------
        // Flush
        //------------------------------
        .after(100, function () {
            h.say('<h2>...<em>flushes</em> the immutable MemTable to a new SST file in level 0.</h2>');
            h.flush(function (sst) { first = sst; });
        })
        .after(latency(1.2), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Only the newest version of each key is written, and tombstones are kept. The old WAL file covered nothing else, so it\'s deleted.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2><em>SST</em> = Sorted String Table: sorted keys in blocks, plus an index and a Bloom filter. Once written, a file is never modified.</h2>'
                + h.cmd('sst_dump --file=' + h.DB + '/' + first.id + ' --command=scan\nsst_dump --file=' + h.DB + '/' + first.id + ' --show_properties'));
        })
        .after(300, function () {
            m().send("ldb", first.id, {type: "ADMIN"});
            h.redraw();
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Your code can also force a flush:</h2>'
                + h.api('db->Flush(FlushOptions());'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // More L0 files
        //------------------------------
        .after(100, function () {
            h.clearHighlights();
            h.say('<h2>Each flush adds another L0 file. Let\'s run two more rounds of writes and flushes.</h2>');
            h.load([["a", "7"], ["g", "2"]]);
            m().switchMemtable();
            h.flush(function () {
                h.load([["b", "8"], ["c", "1"], ["h", "3"]]);
                m().switchMemtable();
                h.flush();
            });
        })
        .after(latency(2.4), h.step).indefinite()
        .after(100, function () {
            h.clearHighlights();
            h.highlight(db().levels[0].map(function (f) { return f.id; }), "check");
            h.say('<h2>L0 files come straight from MemTables, so their key ranges <strong>overlap</strong>. Newest is on the left.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' get_property rocksdb.num-files-at-level0\n' + db().levels[0].length));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.clearHighlights();
            h.say('<h2>The list of live files is recorded in the <em>MANIFEST</em>, a log of every flush and compaction.</h2>'
                + h.cmd('ldb manifest_dump --path=' + h.DB + '/MANIFEST-000005 --verbose\nldb --db=' + h.DB + ' list_live_files_metadata'));
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
