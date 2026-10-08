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
            latency = function (n) { return model().defaultNetworkLatency * n; },
            leader = function () { return node("n0"); },
            setCluster = function (ids) {
                model().nodes.toArray().forEach(function (n) {
                    if (ids.indexOf(n.id) !== -1 || n.id === "n1") {
                        n.cluster(ids);
                    }
                });
            },
            committed = function (command) {
                return function () {
                    var log = leader().log(), last = log[log.length - 1];
                    return last !== undefined && last.command === command && leader().commitIndex() >= last.index;
                };
            };

        //------------------------------
        // Title
        //------------------------------
        frame.after(1, function () {
            model().clear();
            layout.invalidate();
        })
        .after(500, function () {
            h.title("Adding &amp; Removing Peers with <code>ratis sh peer</code>");
        })
        .after(200, wait).indefinite()
        .after(500, function () {
            model().title = "";
            layout.invalidate();
        })

        .after(300, function () {
            model().nodes.create("n0").init();
            model().nodes.create("n1").init();
            model().nodes.create("n2").init();
            h.cluster(["n0", "n1", "n2"]);
            model().clients.create("app");
            h.createOperator();
            layout.invalidate();
        })
        .after(500, function () {
            model().forceLeader("n0");
        })
        .after(latency(1), function () {
            client("app").send(leader(), "SET 5");
        })
        .after(latency(1), function () {
            client("app").send(leader(), "ADD 2");
        })
        .after(1, h.until(function () { return leader().commitIndex() >= 2; })).indefinite()
        .after(latency(2), function () {
            subtitle('<h2>Here\'s a three-peer group with some data. The list of members is itself stored in the Raft log, as a <em>configuration entry</em>.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Start the new peer
        //------------------------------
        .after(1, function () {
            var n3 = model().nodes.create("n3");
            n3._inConf = false;
            n3.init();
            n3.cluster(["n3"]);
            layout.invalidate();
            subtitle('<h2>Step 1: start the new peer n3 with the group id and an <strong>empty</strong> peer list.</h2>'
                + h.api('RaftServer.newBuilder().setServerId(n3)\n    .setGroup(RaftGroup.valueOf(groupId, Collections.emptyList()))\n    .setStateMachine(sm).setProperties(props).build().start();'), false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            subtitle('<h2>n3 isn\'t in any configuration yet, so it never starts an election. Starting it with the full new list is a known way to break the group.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // peer add
        //------------------------------
        .after(1, function () {
            subtitle('<h2>Step 2: ask the group to add it.</h2>'
                + h.cmd('ratis sh peer add -peers $PEERS -peerId n3 -address n3:9872'), false);
        })
        .after(1, wait).indefinite()
        .after(100, function () {
            h.admin(leader(), function () {
                // Staging: the leader replicates to n3 before changing the configuration.
                leader().cluster(["n0", "n1", "n2", "n3"]);
            });
        })
        .after(latency(1.1), function () {
            subtitle('<h2><em>Staging:</em> before changing anything, the leader copies its whole log to n3 so it\'s caught up.</h2>'
                + h.api('client.admin().setConfiguration(List.of(n0, n1, n2, n3))'));
        })
        .after(1, h.until(function () { return node("n3").log().length >= 2; })).indefinite()
        .after(latency(1), function () {
            subtitle('<h2>Now the leader appends a <em>joint configuration</em> C(old,new). Until it commits, decisions need a majority of the old set <strong>and</strong> of the new set.</h2>'
                + h.cmd('ratis sh peer add -peers $PEERS -peerId n3 -address n3:9872'));
            node("n3")._inConf = true;
            node("n3").resetElectionTimer();
            setCluster(["n0", "n1", "n2", "n3"]);
            leader().execute("C(o,n)");
        })
        .after(1, h.until(committed("C(o,n)"))).indefinite()
        .after(1, function () {
            subtitle('<h2>Once C(old,new) commits, the leader appends the final configuration C(new).</h2>');
            leader().execute("C(new)");
        })
        .after(1, h.until(committed("C(new)"))).indefinite()
        .after(latency(1), function () {
            subtitle('<h2>C(new) is committed: n3 is a full voting member and the shell prints success. A majority is now 3 of 4.</h2>'
                + h.cmd('ratis sh peer add -peers $PEERS -peerId n3 -address n3:9872')
                + h.api('StateMachine.notifyConfigurationChanged(term, index, newConf)   // on every peer'), false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // peer remove
        //------------------------------
        .after(1, function () {
            subtitle('<h2>Removing a peer works the same way. Retire n1:</h2>'
                + h.cmd('ratis sh peer remove -peers $PEERS,n3:9872 -peerId n1'), false);
        })
        .after(1, wait).indefinite()
        .after(100, function () {
            h.admin(leader(), function () {
                setCluster(["n0", "n2", "n3"]);
                leader().execute("C(o,n)");
            });
        })
        .after(latency(1.1), function () {
            subtitle('<h2>Again C(old,new) first: n0, n2, n3 must agree, and so must a majority of the old n0, n1, n2...</h2>');
        })
        .after(1, h.until(committed("C(o,n)"))).indefinite()
        .after(1, function () {
            subtitle('<h2>...then C(new) without n1.</h2>', false);
            leader().execute("C(new)");
        })
        .after(1, h.until(committed("C(new)"))).indefinite()
        .after(latency(1), function () {
            node("n1").state("stopped");
            layout.invalidate();
            subtitle('<h2>Once n1 is out of the committed configuration, it shuts itself down. Its storage directory can be deleted.</h2>'
                + h.cmd('ratis sh peer remove -peers $PEERS,n3:9872 -peerId n1'), false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            model().nodes.remove(node("n1"));
            layout.invalidate();
            subtitle('<h2>Watch the ids: if you pass only <code>-address</code>, the shell assumes the id is <code>host_port</code> (here <code>n1_9872</code>). Pass <code>-peerId</code> when your ids are names like n1.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            subtitle('<h2>To swap several peers at once, start the new ones empty and send one <code>setConfiguration()</code> with the final list. Keep both majorities online during the change.</h2>', false);
        })
        .after(1, wait).indefinite()

        .then(function () {
            player.next();
        });

        player.play();
    };
});
