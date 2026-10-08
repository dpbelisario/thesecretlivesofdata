"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./helpers"], function (helpers) {
    return function (frame) {
        var player = frame.player(),
            layout = frame.layout(),
            h = helpers(frame),
            model = h.model,
            node = h.node,
            client = h.client,
            wait = h.wait,
            subtitle = h.subtitle,
            clear = h.clear,
            removeAllNodes = function () {
                model().nodes.toArray().forEach(function (n) { n.state("stopped"); });
                model().nodes.removeAll();
            };

        //------------------------------
        // Title
        //------------------------------
        frame.after(0, function () {
            model().clear();
            layout.invalidate();
        })
        .after(500, function () {
            h.title("Writes, Reads &amp; Partitions");
        })
        .after(200, wait).indefinite()
        .after(500, function () {
            model().title = "";
            layout.invalidate();
        })

        //------------------------------
        // Cluster
        //------------------------------
        .after(300, function () {
            model().nodes.create("n0");
            model().nodes.create("n1");
            model().nodes.create("n2");
            h.cluster(["n0", "n1", "n2"]);
            layout.invalidate();
        })
        .after(500, function () {
            model().forceLeader("n0");
        })

        //------------------------------
        // Write path
        //------------------------------
        .then(function () {
            model().clients.create("app");
            subtitle('<h2>Writes go through the leader\'s log, as in Raft. Here\'s which of your <code>StateMachine</code> methods Ratis calls along the way.</h2>', false);
        })
        .then(wait).indefinite()
        .then(function () {
            subtitle('<h2>The application sends a write with its RaftClient.</h2>'
                + h.api('RaftClientReply reply = client.io().send(Message.valueOf("SET 5"));'), false);
        })
        .then(wait).indefinite()
        .then(function () {
            client("app").send(model().leader(), "SET 5");
        })
        .after(model().defaultNetworkLatency, function () {
            subtitle('<h2>The leader calls <code>startTransaction()</code> to validate the request, then appends it to the log (still uncommitted, so it shows red).</h2>'
                + h.api('TransactionContext startTransaction(RaftClientRequest request)'));
        })
        .at(model(), "appendEntriesRequestsSent", function () {})
        .after(model().defaultNetworkLatency * 0.25, function () {
            subtitle('<h2>The entry goes out to the followers in the next <em>Append Entries</em>.</h2>');
        })
        .after(1, clear)
        .at(model(), "commitIndexChange", function (event) {
            if (event.target === model().leader()) {
                subtitle('<h2>A majority has it, so it\'s committed. Ratis calls <code>applyTransaction()</code> and your state changes to 5...</h2>'
                    + h.api('CompletableFuture&lt;Message&gt; applyTransaction(TransactionContext trx)'));
                return true;
            }
            return false;
        })
        .after(model().defaultNetworkLatency * 0.25, function () {
            subtitle('<h2>...and the leader sends a <code>RaftClientReply</code> back to the client. Followers apply the same entry on the next heartbeat.</h2>');
        })
        .after(1, function () {
            subtitle('<h2>By default the reply comes once a <em>majority</em> has the entry. You can wait for more with a <code>ReplicationLevel</code>:</h2>'
                + h.api('client.async().send(msg, ReplicationLevel.ALL)\nclient.io().watch(reply.getLogIndex(), ReplicationLevel.ALL_COMMITTED)'));
        })
        .after(1, clear)
        .after(model().defaultNetworkLatency, function () {
            subtitle('<h2>Now send "ADD 2"...</h2>', false);
            client("app").send(model().leader(), "ADD 2");
        })
        .at(model(), "recv", function () {
            subtitle('<h2>...and every peer\'s StateMachine ends up at 7.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Read path
        //------------------------------
        .after(1, function () {
            subtitle('<h2>Reads skip the log. Ratis calls your <code>query()</code> method directly.</h2>'
                + h.api('client.io().sendReadOnly(Message.valueOf("GET"))'), false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            var leader = model().leader();
            client("app").value("");
            subtitle('<h2>With <code>raft.server.read.option = LINEARIZABLE</code>, the leader first checks it is still leader with a heartbeat round (<em>ReadIndex</em>)...</h2>', false);
            model().send(client("app"), leader, {type: "READ"}, function () {
                leader.sendAppendEntriesRequests();
                frame.after(model().defaultNetworkLatency * 2, function () {
                    subtitle('<h2>...then answers from its state machine. The <code>DEFAULT</code> option skips that check: faster, but a cut-off old leader could return stale data.</h2>', false);
                    model().send(leader, client("app"), {type: "READ"}, function () {
                        client("app").value(String(leader.value()));
                        layout.invalidate();
                    });
                });
            });
            layout.invalidate();
        })
        .after(model().defaultNetworkLatency * 4 + 100, wait).indefinite()
        .after(1, function () {
            subtitle('<h2>Other read options: read from a follower, require a minimum applied index, or read your own last write.</h2>'
                + h.api('client.io().sendReadOnly(msg, followerId)\nclient.io().sendStaleRead(msg, minIndex, peerId)\nclient.io().sendReadAfterWrite(msg)'), false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Network partition
        //------------------------------
        .after(1, function () {
            removeAllNodes();
            model().clients.removeAll();
            model().clients.create("app");
            ["n0", "n1", "n2", "n3", "n4"].forEach(function (id) { model().nodes.create(id); });
            layout.invalidate();
        })
        .after(500, function () {
            ["n0", "n1", "n2", "n3", "n4"].forEach(function (id) { node(id).init(); });
            h.cluster(["n0", "n1", "n2", "n3", "n4"]);
            model().forceLeader("n1");
        })
        .after(1, function () {
            subtitle('<h2>Now a five-peer group with leader n1. Let\'s split the network: n0 &amp; n1 on one side, n2, n3 &amp; n4 on the other.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            ["n2", "n3", "n4"].forEach(function (id) {
                model().latency("n0", id, 0).latency("n1", id, 0);
            });
            model().ensureExactCandidate("n2");
            var p = model().partitions.create("-");
            p.x1 = Math.min.apply(null, model().nodes.toArray().map(function (n) { return n.x; }));
            p.x2 = Math.max.apply(null, model().nodes.toArray().map(function (n) { return n.x; }));
            p.y1 = p.y2 = Math.round(node("n1").y + node("n2").y) / 2;
            layout.invalidate();
        })
        .after(model().defaultNetworkLatency, function () {
            client("app").send(node("n1"), "SET 3");
            subtitle('<h2>A client writes "SET 3" to n1, which still thinks it\'s leader. It can\'t reach a majority, so the entry stays uncommitted.</h2>', false);
        })
        .after(1, h.until(function () {
            return node("n1").state() !== "leader";
        })).indefinite()
        .after(1, function () {
            subtitle('<h2>Unlike textbook Raft, a Ratis leader that hasn\'t heard from a majority for 2&times; the election timeout steps down on its own (<code>LOST_MAJORITY_HEARTBEATS</code>).</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, h.until(function () {
            return model().leader(["n2", "n3", "n4"]) !== undefined;
        })).indefinite()
        .after(1, function () {
            var leader = model().leader(["n2", "n3", "n4"]);
            subtitle('<h2>The majority side elects ' + leader.id + ' in term ' + leader.currentTerm() + '. The minority side keeps pre-voting and never wins, so its terms don\'t climb.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            var leader = model().leader(["n2", "n3", "n4"]);
            client("app").send(leader, "SET 8");
            subtitle('<h2>The client gets <code>NotLeaderException</code> from n1, retries the new leader ' + leader.id + ', and "SET 8" commits.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            subtitle('<h2>Now heal the partition.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            model().partitions.removeAll();
            layout.invalidate();
        })
        .after(200, function () {
            model().resetLatencies();
        })
        .after(1, h.until(function () {
            return node("n1").log().length > 0 && node("n1").log()[0].command === "SET 8" && node("n1").commitIndex() > 0;
        })).indefinite()
        .after(1, function () {
            subtitle('<h2>n0 and n1 take the new leader\'s log. The uncommitted "SET 3" is overwritten, and every peer agrees on 8.</h2>', false);
        })
        .after(1, wait).indefinite()

        .then(function () {
            player.next();
        });

        player.play();
    };
});
