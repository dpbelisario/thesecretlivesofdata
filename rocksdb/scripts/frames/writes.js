"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./helpers"], function (helpers) {
    return function (frame) {
        var player = frame.player(),
            h = helpers(frame),
            m = h.model,
            db = h.db,
            latency = function (n) { return m().defaultNetworkLatency * n; };

        frame.after(1, function () {
            m().clear();
            h.redraw();
        })
        .after(500, function () {
            h.title("The Write Path: WAL &amp; MemTable");
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            m().title = "";
            db().visible = {mem: true, wal: true, levels: true};
            h.app();
            h.ldb();
            h.say('<h2>An empty database. Your service writes key <code>a</code>:</h2>'
                + h.api('db->Put(WriteOptions(), "a", "1");'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // One put
        //------------------------------
        .after(100, function () {
            h.say('<h2>1. The write is appended to the WAL first and gets a <em>sequence number</em>, #1.</h2>');
            h.put("app", "a", "1");
        })
        .after(latency(1.2), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>2. Then it goes into the MemTable, a sorted skiplist in memory. That\'s it: the write is done, and no data file was touched.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>By default the WAL write lands in the OS page cache without an fsync. You choose the durability per write:</h2>'
                + h.api('WriteOptions wo;\nwo.sync = true;        // fsync the WAL before returning (default false)\nwo.disableWAL = true;  // skip the WAL entirely (default false)'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // More puts, overwrite
        //------------------------------
        .after(100, function () {
            h.say('<h2>Two more writes, b and c...</h2>');
            h.put("app", "b", "2", function () {
                h.put("app", "c", "3");
            });
        })
        .after(latency(3.6), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Now overwrite <code>a</code>. The old entry isn\'t changed. A newer version, #4, is added, and the highest sequence number wins.</h2>');
            h.put("app", "a", "5");
        })
        .after(latency(1.8), h.step).indefinite()

        //------------------------------
        // Delete
        //------------------------------
        .after(100, function () {
            h.say('<h2>Deleting doesn\'t remove anything either. It writes a <em>tombstone</em> that hides older versions of the key.</h2>'
                + h.api('db->Delete(WriteOptions(), "b");'));
            h.put("app", "b", null);
        })
        .after(latency(1.8), h.step).indefinite()

        //------------------------------
        // WriteBatch
        //------------------------------
        .after(100, function () {
            h.say('<h2>A <em>WriteBatch</em> applies several changes atomically: one WAL record, consecutive sequence numbers.</h2>'
                + h.api('WriteBatch batch;\nbatch.Put("d", "4");\nbatch.Delete("c");\ndb->Write(WriteOptions(), &batch);'));
        })
        .after(300, function () {
            m().send("app", "lbl-wal", {type: "PUT"}, function () {
                m().writeBatch([["d", "4"], ["c", null]]);
                h.redraw();
            });
            h.redraw();
        })
        .after(latency(1.2), h.step).indefinite()

        //------------------------------
        // ldb
        //------------------------------
        .after(100, function () {
            h.say('<h2>From the shell, <code>ldb</code> reads the same data. Read commands open the database read-only, so they work while your service is running.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' get a\n5\nldb --db=' + h.DB + ' scan\na ==> 5\nd ==> 4'));
        })
        .after(300, function () {
            m().send("ldb", db().mem.id, {type: "ADMIN"}, function () {
                m().send(db().mem.id, "ldb", {type: "ADMIN"});
            });
            h.redraw();
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Write commands need RocksDB\'s LOCK file, which your running service holds, so use them only while it\'s stopped.</h2>'
                + h.cmd('ldb --db=' + h.DB + ' put e 7 --create_if_missing\nldb --db=' + h.DB + ' delete e'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            var wal = ("000000" + db().walNo).slice(-6);
            h.say('<h2><code>dump_wal</code> prints every record in a WAL file: what would be replayed after a crash.</h2>'
                + h.cmd('ldb dump_wal --walfile=' + h.DB + '/' + wal + '.log --print_value'));
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
