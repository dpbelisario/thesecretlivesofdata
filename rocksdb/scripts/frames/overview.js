"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./helpers"], function (helpers) {
    return function (frame) {
        var player = frame.player(),
            h = helpers(frame),
            db = h.db;

        frame.after(1, function () {
            h.model().clear();
            db().visible = {mem: false, wal: false, levels: false};
            h.redraw();
        })
        .after(500, function () {
            h.say('<h2><em>RocksDB</em> is an embedded key-value store: a C++ library (with Java bindings) that keeps sorted keys on local disk.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Like Ratis, it isn\'t a server. You link it into your own process, as Apache Ozone, Kafka Streams, Apache Flink and TiKV do.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>It\'s a <em>Log-Structured Merge tree</em> (LSM tree). Files are never changed in place, which keeps writes fast.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(100, function () {
            db().visible.mem = true;
            h.say('<h2>Writes go into an in-memory, sorted <em>MemTable</em>...</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            db().visible.wal = true;
            h.say('<h2>...and are appended to a <em>write-ahead log</em> (WAL) on disk, so they survive a crash.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            db().visible.levels = true;
            h.say('<h2>Full MemTables are written out as immutable, sorted <em>SST files</em>, arranged in levels L0, L1, L2 and so on.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Background <em>compaction</em> merges files down the levels, throwing away overwritten and deleted data.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(100, function () {
            h.app();
            h.say('<h2>Your service talks to it through the API...</h2>'
                + h.api('DB* db;\nDB::Open(options, "' + h.DB + '", &db);\ndb->Put(WriteOptions(), "a", "1");'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.ldb();
            h.say('<h2>...and operators inspect a database with two command line tools that ship with RocksDB: <code>ldb</code> and <code>sst_dump</code>.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' get a\nsst_dump --file=' + h.DB + '/000012.sst --command=scan'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Let\'s follow a write.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
