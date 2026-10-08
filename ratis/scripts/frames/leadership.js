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
            wait = h.wait,
            subtitle = h.subtitle,
            latency = function (n) { return model().defaultNetworkLatency * n; },
            stepped = null,
            target = null;

        //------------------------------
        // Title
        //------------------------------
        frame.after(1, function () {
            model().clear();
            layout.invalidate();
        })
        .after(500, function () {
            h.title("Steering Leadership with <code>ratis sh election</code>");
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
            h.createOperator();
            layout.invalidate();
        })
        .after(500, function () {
            model().forceLeader("n0");
        })
        .after(1, function () {
            subtitle('<h2>Ratis picks leaders by itself, but before maintenance you often want to move leadership on purpose.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Transfer
        //------------------------------
        .after(1, function () {
            subtitle('<h2>n0\'s host needs patching. Hand leadership to n2:</h2>'
                + h.cmd('ratis sh election transfer -peers $PEERS -address n2:9872'), false);
        })
        .after(1, wait).indefinite()
        .after(300, function () {
            h.admin(node("n0"), function () {
                node("n0").sendStartLeaderElection(node("n2"));
            });
        })
        .after(latency(1.1), function () {
            subtitle('<h2>The shell calls <code>admin().transferLeadership(n2)</code>. The leader checks n2 is caught up, then sends it a <em style="color:purple">StartLeaderElection</em>.</h2>'
                + h.api('client.admin().transferLeadership(RaftPeerId.valueOf("n2"), timeoutMs)'));
        })
        .at(model(), "stateChange", function (event) {
            return (event.target.id === "n2" && event.target.state() === "leader");
        })
        .after(1, function () {
            subtitle('<h2>n2 starts an election right away, skipping the timeout and the pre-vote, and becomes leader of term ' + node("n2").currentTerm() + '.</h2>'
                + h.api('# If n2 has a lower priority than another peer, the shell raises it first\n# with setConfiguration(), or the leader would hand leadership straight back.'), false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Pause / resume
        //------------------------------
        .after(1, function () {
            subtitle('<h2>Now make sure n0 can\'t win leadership back while it\'s being patched:</h2>'
                + h.cmd('ratis sh election pause -peers $PEERS -address n0:9872'), false);
        })
        .after(1, wait).indefinite()
        .after(300, function () {
            h.admin(node("n0"), function () {
                node("n0")._electionPaused = true;
                node("n0").clearElectionTimer();
                layout.invalidate();
            });
        })
        .after(latency(2) + 100, function () {
            subtitle('<h2>n0 still follows the leader and copies the log, but its election timer is gone. It will never start an election.</h2>'
                + h.api('client.getLeaderElectionManagementApi(RaftPeerId.valueOf("n0")).pause()'));
        })
        .after(1, function () {
            subtitle('<h2>Let\'s test it: stop the leader, n2.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            node("n2").state("stopped");
            subtitle('', false);
        })
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "leader");
        })
        .after(1, function () {
            subtitle('<h2>Only n1 could run for election, so n1 leads term ' + node("n1").currentTerm() + '. Paused peers still vote, they just never campaign.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            node("n2").state("follower");
            subtitle('<h2>Bring n2 back (it rejoins as a follower), then let n0 campaign again:</h2>'
                + h.cmd('ratis sh election resume -peers $PEERS -address n0:9872'), false);
        })
        .after(1, wait).indefinite()
        .after(300, function () {
            h.admin(node("n0"), function () {
                node("n0")._electionPaused = false;
                node("n0").resetElectionTimer();
                layout.invalidate();
            });
        })
        .after(latency(2) + 100, function () {
            subtitle('<h2>n0\'s election timer is back, so it can campaign again.</h2>'
                + h.api('client.getLeaderElectionManagementApi(RaftPeerId.valueOf("n0")).resume()'));
        })

        //------------------------------
        // Step down
        //------------------------------
        .after(1, function () {
            stepped = model().leader();
            subtitle('<h2>Sometimes you just want the current leader, ' + stepped.id + ', to step aside, whoever takes over:</h2>'
                + h.cmd('ratis sh election stepDown -peers $PEERS'), false);
        })
        .after(1, wait).indefinite()
        .after(300, function () {
            h.admin(stepped, function () {
                stepped._stepDownWait = true;
                stepped.state("follower");
                layout.invalidate();
            });
        })
        .after(latency(1.1), function () {
            subtitle('<h2>' + stepped.id + ' steps down. It can\'t be re-elected for a while, so another peer takes over.</h2>'
                + h.api('raft.server.leaderelection.leader.step-down.wait-time = 10s'));
        })
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "leader");
        })
        .after(1, function () {
            stepped._stepDownWait = false;
            stepped.resetElectionTimer();
            subtitle('<h2>' + model().leader().id + ' is the new leader of term ' + model().leader().currentTerm() + '.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Priority
        //------------------------------
        .after(1, function () {
            target = model().nodes.toArray().filter(function (n) { return n.state() === "follower"; })[0];
            subtitle('<h2>For a lasting preference, use <em>priority</em>. Ratis keeps moving leadership toward the highest-priority peer that is caught up.</h2>'
                + h.cmd('ratis sh peer setPriority -peers $PEERS -addressPriority ' + target.id + ':9872|2'), false);
        })
        .after(1, wait).indefinite()
        .after(300, function () {
            var leader = model().leader();
            h.admin(leader, function () {
                // setPriority is a configuration change: it goes through the log.
                leader.execute("C(prio)");
            });
        })
        .at(model(), "commitIndexChange", function (event) {
            return event.target === model().leader();
        })
        .after(1, function () {
            target._priority = 2;
            layout.invalidate();
            subtitle('<h2>The new priorities are a configuration change, so they go through the log like any other entry.</h2>'
                + h.api('client.admin().setConfiguration(peersWithNewPriorities)'));
        })
        .after(1, function () {
            model().leader().sendStartLeaderElection(target);
            subtitle('<h2>The leader sees that ' + target.id + ' has a higher priority and hands leadership over.</h2>', false);
        })
        .at(model(), "stateChange", function (event) {
            return (event.target === target && event.target.state() === "leader");
        })
        .after(1, function () {
            subtitle('<h2>' + target.id + ' is leader. Higher priority wins whenever that peer is up and caught up.</h2>', false);
        })
        .after(1, wait).indefinite()

        .then(function () {
            player.next();
        });

        player.play();
    };
});
