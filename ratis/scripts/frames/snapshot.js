"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["../model/log_entry", "./helpers"], function (LogEntry, helpers) {
    return function (frame) {
        var player = frame.player(),
            layout = frame.layout(),
            h = helpers(frame),
            model = h.model,
            node = h.node,
            client = h.client,
            say = function (s) {
                frame.snapshot();
                model().subtitle = s + model().controls.html();
                layout.invalidate();
            },
            commands = ["SET 5", "ADD 2", "ADD 3", "SUB 1"],
            fill = function (n, upto) {
                var i;
                n._log = [];
                for (i = 0; i < upto; i += 1) {
                    n._log.push(new LogEntry(model(), i + 1, 1, commands[i]));
                }
                n._commitIndex = upto;
                n._value = 9;
                n._currentTerm = 1;
            },
            compact = function (n) {
                n._log = [new LogEntry(model(), 4, 1, "SNAP@4")];
                layout.invalidate();
            },
            append = function (n, entries) {
                entries.forEach(function (e) { n._log.push(new LogEntry(model(), e[0], 1, e[1])); });
                layout.invalidate();
            };

        frame.after(1, function () {
            model().clear();
            model().nodeLabelVisible = true;
            ["n0", "n1", "n2"].forEach(function (id) {
                var n = model().nodes.create(id);
                fill(n, 4);
                n._leaderId = "n0";
            });
            node("n0")._state = "leader";
            node("n0")._leaderId = null;
            layout.invalidate();
        })
        .after(500, function () {
            model().title = '<h2 style="visibility:visible">Snapshots with <code>ratis sh snapshot</code></h2>'
                + '<br/>' + model().controls.html();
            layout.invalidate();
        })
        .after(200, h.step).indefinite()
        .after(300, function () {
            model().title = "";
            say('<h2>Every write adds a log entry. Left alone, the log grows forever, and a new peer would have to replay all of it.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>A <em>snapshot</em> saves the StateMachine\'s state as of one log index. Every entry up to that index can then be deleted.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>Ratis can take one automatically every N applied entries...</h2>'
                + h.api('raft.server.snapshot.auto.trigger.enabled   = true     # default false\nraft.server.snapshot.auto.trigger.threshold = 400000'));
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // snapshot create
        //------------------------------
        .after(100, function () {
            h.createOperator();
            say('<h2>...or an operator can ask a specific peer for one:</h2>'
                + h.cmd('ratis sh snapshot create -peers $PEERS -peerId n1'));
        })
        .after(800, function () {
            h.admin(node("n1"), function () {
                compact(node("n1"));
            });
            layout.invalidate();
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>Ratis calls <code>takeSnapshot()</code>. Your code writes the state to disk and returns the last index it covers. n1 can now delete entries 1&ndash;4.</h2>'
                + h.api('long takeSnapshot()   // e.g. writes sm/snapshot.1_4\n\n<raft.server.storage.dir>/<group-uuid>/\n  current/  raft-meta  raft-meta.conf  log_inprogress_5\n  sm/       snapshot.1_4'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            compact(node("n0"));
            compact(node("n2"));
            say('<h2>Each peer snapshots on its own schedule. Snapshots aren\'t replicated through the log.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            ["n0", "n1", "n2"].forEach(function (id) {
                append(node(id), [[5, "ADD 1"], [6, "ADD 1"]]);
                node(id)._commitIndex = 6;
                node(id)._value = 11;
            });
            say('<h2>Writes continue. The log now holds only entries 5&ndash;6 after the snapshot.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Install snapshot
        //------------------------------
        .after(100, function () {
            var n3 = model().nodes.create("n3");
            n3._leaderId = "n0";
            say('<h2>A new peer n3 joins. It needs entries 1&ndash;4, but the leader has already deleted them.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>So the leader sends its snapshot instead, in chunks: <em style="color:orange">InstallSnapshot</em>.</h2>'
                + h.api('raft.server.log.appender.install.snapshot.enabled = true   # default'));
        })
        .after(300, function () {
            model().send(node("n0"), node("n3"), {type: "ISREQ"}, function () {
                node("n3")._log = [new LogEntry(model(), 4, 1, "SNAP@4")];
                node("n3")._commitIndex = 4;
                node("n3")._value = 9;
                node("n3")._currentTerm = 1;
                layout.invalidate();
            });
            layout.invalidate();
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>n3\'s StateMachine loads the snapshot in <code>reinitialize()</code>. Then ordinary Append Entries deliver 5&ndash;6.</h2>');
        })
        .after(300, function () {
            model().send(node("n0"), node("n3"), {type: "AEREQ"}, function () {
                append(node("n3"), [[5, "ADD 1"], [6, "ADD 1"]]);
                node("n3")._commitIndex = 6;
                node("n3")._value = 11;
                layout.invalidate();
            });
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>If your state is too big to stream, turn that off. Ratis then calls <code>notifyInstallSnapshotFromLeader()</code> and your code copies the data itself, for example from a RocksDB checkpoint.</h2>'
                + h.api('raft.server.log.appender.install.snapshot.enabled = false'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>That\'s where the two halves of this guide meet: a Ratis StateMachine often keeps its state in <em>RocksDB</em>.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
