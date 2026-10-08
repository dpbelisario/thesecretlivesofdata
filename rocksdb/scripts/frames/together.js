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
            CP = "/data/snapshots/idx-42";

        frame.after(1, function () {
            m().clear();
            h.redraw();
        })
        .after(500, function () {
            h.title("Ratis + RocksDB");
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            var sm = m().clients.create("sm");
            m().title = "";
            db().visible = {mem: true, wal: true, levels: true};
            h.load([["k1", "a"], ["k2", "b"], ["k3", "c"], ["k4", "d"], ["#idx", "38"]]);
            m().switchMemtable();
            m().flush();
            m().compact(0);
            h.load([["k2", "e"], ["#idx", "40"]]);
            m().switchMemtable();
            m().flush();
            h.load([["k5", "f"], ["#idx", "41"]]);
            sm.value("SM");
            sm.color = "steelblue";
            sm.caption = "StateMachine";
            h.ldb();
            h.say('<h2>Back to Ratis. A common design, used by Apache Ozone\'s Ozone Manager, is a StateMachine that keeps its state in RocksDB.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // applyTransaction -> WriteBatch
        //------------------------------
        .after(100, function () {
            h.say('<h2>When Ratis commits log entry 42, <code>applyTransaction()</code> writes it as one WriteBatch that also records the applied index, so the data and the Raft position always move together.</h2>'
                + h.api('// sketch, RocksJava\npublic CompletableFuture&lt;Message&gt; applyTransaction(TransactionContext trx) {\n  try (WriteBatch batch = new WriteBatch()) {\n    batch.put(key, value);\n    batch.put(IDX_KEY, toBytes(trx.getLogEntry().getIndex()));   // "#idx"\n    db.write(writeOptions, batch);\n  } ...'));
        })
        .after(300, function () {
            m().send("sm", "lbl-wal", {type: "PUT"}, function () {
                m().writeBatch([["k6", "g"], ["#idx", "42"]]);
                h.redraw();
            });
            h.redraw();
        })
        .after(latency(1.2), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>After a restart, the StateMachine reads <code>#idx</code> back and reports it from <code>getLastAppliedTermIndex()</code>. Ratis then replays only the newer log entries.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>Since the Raft log already makes each write durable, some designs turn off RocksDB\'s WAL for these writes and rely on Raft replay instead. That\'s a trade-off you choose.</h2>'
                + h.api('writeOptions.setDisableWAL(true);'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // takeSnapshot -> checkpoint
        //------------------------------
        .after(100, function () {
            h.say('<h2>When Ratis calls <code>takeSnapshot()</code>, create a RocksDB <em>checkpoint</em>. By default it flushes the MemTable first...</h2>'
                + h.api('Checkpoint.create(db).createCheckpoint("' + CP + '");')
                + h.cmd('ldb --db=' + h.DB + ' checkpoint --checkpoint_dir=' + CP));
            m().switchMemtable();
            h.flush();
        })
        .after(latency(1.4), function () {
            m().checkpoint(CP);
            h.clearHighlights();
            h.highlight(["checkpoint"], "new");
        })
        .after(latency(0.5), h.step).indefinite()
        .after(100, function () {
            h.say('<h2>...then hard-links every live SST file into the new directory and copies the small MANIFEST. It\'s nearly instant and takes no extra disk space up front.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.clearHighlights();
            h.say('<h2>SST files are never modified, so the links stay valid while compaction carries on. When compaction deletes a file, the checkpoint\'s link keeps its data alive.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>A follower that has fallen far behind gets this directory (via InstallSnapshot, or your own copy in <code>notifyInstallSnapshotFromLeader()</code>), opens it as its database, and continues from index 42.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            h.say('<h2>That\'s the full picture: <em>Ratis</em> agrees on the order of writes across machines, and <em>RocksDB</em> stores them efficiently on each one.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
