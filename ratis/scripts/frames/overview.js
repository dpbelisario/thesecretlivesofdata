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
            };

        frame.after(1, function () {
            model().nodeLabelVisible = false;
            model().clear();
            model().nodes.create("n0");
            model().nodes.create("n1");
            model().nodes.create("n2");
            layout.invalidate();
        })

        .after(800, function () {
            say('<h2><em>Apache Ratis</em> is a Java library that implements the Raft consensus protocol.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>It isn\'t a server you deploy on its own. You embed it in your service, as Apache Ozone does.</h2>');
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Peers and groups
        //------------------------------
        .after(100, function () {
            model().zoom([node("n1")]);
            say('<h2>Each process runs a <em>RaftServer</em>, called a <em>peer</em>. Every peer has an id and an address.</h2>'
                + h.api('RaftPeer.newBuilder().setId("n1").setAddress("n1:9872").build()'));
        })
        .after(100, h.step).indefinite()
        .after(300, function () {
            model().zoom(null);
            model().nodeLabelVisible = true;
            say('<h2>Peers that replicate the same data form a <em>RaftGroup</em>, identified by a UUID.</h2>'
                + h.api('RaftGroup.valueOf(RaftGroupId.valueOf(uuid), n0, n1, n2)'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>One server can belong to many groups at once (<em>multi-Raft</em>). That\'s why every <code>ratis sh</code> command accepts <code>-groupid</code>.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>Peers are <em>Followers</em>, <em>Candidates</em> or a <em>Leader</em>, just like in Raft. Ratis also has a non-voting <em>Listener</em> role.</h2>');
        })
        .after(300, function () {
            node("n0")._state = "leader";
            node("n1")._leaderId = "n0";
            node("n2")._leaderId = "n0";
            layout.invalidate();
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // StateMachine + RaftClient
        //------------------------------
        .after(100, function () {
            say('<h2>Your business logic plugs in as a <em>StateMachine</em>. The number inside each peer is its state.</h2>'
                + h.api('class MyStateMachine extends BaseStateMachine { applyTransaction(trx) { ... } }'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            model().clients.create("app");
            say('<h2>Applications send writes through a <em>RaftClient</em>. Each write is a <code>Message</code>.</h2>'
                + h.api('client.io().send(Message.valueOf("SET 5"))'));
        })
        .after(800, function () {
            client("app")._value = "5";
            layout.invalidate();
        })
        .after(500, function () {
            model().send(client("app"), node("n0"), null, function () {
                node("n0")._log.push(new LogEntry(model(), 1, 1, "SET 5"));
                layout.invalidate();
            });
            layout.invalidate();
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>The leader appends the message to its Raft log and replicates it...</h2>');
        })
        .after(300, function () {
            ["n1", "n2"].forEach(function (id) {
                model().send(node("n0"), node(id), {type: "AEREQ"}, function () {
                    node(id)._log.push(new LogEntry(model(), 1, 1, "SET 5"));
                    layout.invalidate();
                });
            });
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>...and once a majority has stored it, Ratis calls <code>applyTransaction()</code> on every peer\'s StateMachine.</h2>');
        })
        .after(300, function () {
            ["n0", "n1", "n2"].forEach(function (id) {
                node(id)._commitIndex = 1;
                node(id)._value = 5;
            });
            layout.invalidate();
        })
        .after(100, h.step).indefinite()

        //------------------------------
        // Operators
        //------------------------------
        .after(100, function () {
            h.createOperator();
            say('<h2>Operators manage the group with <code>ratis sh</code>, a command line tool built on Ratis\'s admin API.</h2>'
                + h.cmd('export PEERS=' + h.PEERS + '\nratis sh group info -peers $PEERS'));
        })
        .after(800, function () {
            h.admin(node("n0"));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>The shell asks any peer in <code>-peers</code> for the group\'s details, then talks to the right one.</h2>'
                + h.cmd('ratis sh group info -peers $PEERS\ngroup id: 02511d47-d67c-49a3-9011-abb3109a44c1\nleader info: n0(n0:9872)'));
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>So there are four ways to drive Ratis: <em>writes &amp; reads</em> via RaftClient, the <em>admin API</em>, the <em>ratis sh</em> CLI, and <code>raft.server.*</code> <em>config</em>.</h2>');
        })
        .after(100, h.step).indefinite()
        .after(100, function () {
            say('<h2>Let\'s see each one in action.</h2>');
        })
        .after(100, h.step).indefinite()

        .after(300, function () {
            frame.snapshot();
            player.next();
        });

        player.play();
    };
});
