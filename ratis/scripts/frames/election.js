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
            isolated = null;

        //------------------------------
        // Title
        //------------------------------
        frame.after(1, function () {
            model().clear();
            layout.invalidate();
        })
        .after(500, function () {
            h.title("Leader Election &amp; Pre-Vote");
        })
        .after(200, wait).indefinite()
        .after(500, function () {
            model().title = "";
            layout.invalidate();
        })

        //------------------------------
        // Initialization
        //------------------------------
        .after(300, function () {
            model().nodes.create("n0").init();
            model().nodes.create("n1").init();
            model().nodes.create("n2").init();
            h.cluster(["n0", "n1", "n2"]);
        })

        //------------------------------
        // Election timeout
        //------------------------------
        .after(1, function () {
            model().ensureSingleCandidate();
            subtitle('<h2>Ratis uses the same <span style="color:green">election timeout</span> as Raft, picked at random within a range you configure.</h2>'
                + h.api('raft.server.rpc.timeout.min = 150ms\nraft.server.rpc.timeout.max = 300ms'), false);
        })
        .after(model().electionTimeout / 2, function () { model().controls.show(); })
        .after(100, function () {
            subtitle('', false);
        })

        //------------------------------
        // Pre-vote
        //------------------------------
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "precandidate");
        })
        .after(1, function () {
            subtitle('<h2>When the timeout fires, a Ratis follower first becomes a <em>pre-candidate</em> (dotted ring)...</h2>'
                + h.api('raft.server.leaderelection.pre-vote = true   # the default'));
        })
        .after(1, function () {
            subtitle('<h2>...and sends <em>Pre-Vote</em> requests asking: "would you vote for me?" <strong>Its term does not change yet.</strong></h2>');
        })
        .after(model().defaultNetworkLatency, function () {
            subtitle('<h2>A peer says yes only if the candidate\'s log is up to date and it hasn\'t heard from a leader for a full election timeout.</h2>');
        })

        //------------------------------
        // Real election
        //------------------------------
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "candidate");
        })
        .after(1, function () {
            subtitle('<h2>With a majority of pre-votes, it runs the real election: new term, votes for itself, sends <em>Request Vote</em>.</h2>');
        })
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "leader");
        })
        .after(1, function () {
            subtitle('<h2>Peer ' + model().leader().id + ' wins a majority and becomes leader of term ' + model().leader().currentTerm() + '.</h2>'
                + h.api('StateMachine.notifyLeaderChanged(...)   // on every peer\nStateMachine.notifyLeaderReady()        // on the new leader'));
        })
        .after(model().defaultNetworkLatency, function () {
            subtitle('<h2>The leader sends <em>Append Entries</em> heartbeats to keep followers from timing out.</h2>');
        })

        //------------------------------
        // Find the leader from the shell
        //------------------------------
        .after(1, function () {
            h.createOperator();
            subtitle('<h2>From the shell, <code>group info</code> shows who the leader is, plus each peer\'s commit index.</h2>'
                + h.cmd('ratis sh group info -peers $PEERS'), false);
        })
        .after(600, function () {
            h.admin(model().leader());
        })
        .after(model().defaultNetworkLatency * 2 + 100, function () {
            var l = model().leader();
            subtitle('<h2>From the shell, <code>group info</code> shows who the leader is, plus each peer\'s commit index.</h2>'
                + h.cmd('ratis sh group info -peers $PEERS\nleader info: ' + l.id + '(' + l.id + ':9872)'));
        })

        //------------------------------
        // Re-election
        //------------------------------
        .after(1, function () {
            subtitle('<h2>Let\'s stop the leader and watch a re-election.</h2>', false);
        })
        .after(100, wait).indefinite()
        .after(1, function () {
            subtitle('', false);
            model().leader().state("stopped");
        })
        .after(model().defaultNetworkLatency, function () {
            model().ensureSingleCandidate();
        })
        .at(model(), "stateChange", function (event) {
            return (event.target.state() === "leader");
        })
        .after(1, function () {
            subtitle('<h2>Pre-vote, then vote: peer ' + model().leader().id + ' is now leader of term ' + model().leader().currentTerm() + '.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            model().nodes.toArray().forEach(function (n) {
                if (n.state() === "stopped") {
                    n.state("follower");
                }
            });
            subtitle('<h2>We restart the old leader. It sees the higher term and rejoins as a follower.</h2>', false);
        })
        .after(1, wait).indefinite()

        //------------------------------
        // Why pre-vote: isolated peer
        //------------------------------
        .after(1, function () {
            isolated = model().nodes.toArray().filter(function (n) { return n.state() === "follower"; })[0];
            subtitle('<h2>Why pre-vote? Let\'s cut peer ' + isolated.id + ' off from the others.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            h.isolate(isolated.id);
            subtitle('', false);
        })
        .at(model(), "stateChange", function (event) {
            return (event.target === isolated && event.target.state() === "precandidate");
        })
        .after(1, function () {
            subtitle('<h2>Peer ' + isolated.id + ' times out, but nobody answers its pre-votes. It keeps retrying, and its term stays at ' + isolated.currentTerm() + '.</h2>', false);
        })
        .after(model().electionTimeout * 3, function () {
            subtitle('<h2>Without pre-vote it would bump its term on every timeout. When it came back, that higher term would force the healthy leader to step down.</h2>', false);
        })
        .after(1, wait).indefinite()
        .after(1, function () {
            model().partitions.removeAll();
            model().resetLatencies();
            layout.invalidate();
            subtitle('<h2>Heal the network...</h2>', false);
        })
        .at(model(), "stateChange", function (event) {
            return (event.target === isolated && event.target.state() === "follower");
        })
        .after(1, function () {
            subtitle('<h2>...and ' + isolated.id + ' quietly rejoins as a follower. The leader was never disturbed.</h2>', false);
        })
        .after(1, wait).indefinite()

        .then(function () {
            player.next();
        });

        player.play();
    };
});
