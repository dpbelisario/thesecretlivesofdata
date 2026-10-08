"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define([], function () {
    return function (frame) {
        var player = frame.player(),
            layout = frame.layout(),
            row = function (cmd, what) {
                return '<li><code>' + cmd + '</code> &mdash; ' + what + '</li>';
            };

        frame.after(1, function () {
            frame.model().clear();
            layout.invalidate();
        })

        .after(500, function () {
            frame.model().title = '<h2 style="visibility:visible">ratis sh cheat sheet</h2>'
                + '<ul class="cheatsheet" style="visibility:visible">'
                + row('election transfer -address h:p', 'move leadership (admin().transferLeadership)')
                + row('election stepDown', 'current leader steps aside')
                + row('election pause | resume -address h:p', 'stop / allow one peer from campaigning')
                + row('group info [-groupid id]', 'leader, commit indexes, log info')
                + row('group list -peerId id', 'groups a server belongs to (multi-Raft)')
                + row('peer add -peerId id -address h:p', 'joint-consensus add (setConfiguration)')
                + row('peer remove -peerId id', 'joint-consensus remove; removed peer shuts down')
                + row('peer setPriority -addressPriority "h:p|N"', 'prefer a leader')
                + row('snapshot create -peerId id', 'StateMachine.takeSnapshot() on one peer')
                + row('local raftMetaConf -peers ... -path dir', 'offline: rewrite raft-meta.conf to move a peer to a new address')
                + '</ul>'
                + '<p style="visibility:visible">Every command takes <code>-peers h:p,h:p,...</code> and optional <code>-groupid</code>. '
                + '<code>-D&lt;key&gt;=&lt;value&gt;</code> sets client properties.</p>'
                + '<h3 style="visibility:visible">Next: <a href="../rocksdb/">Part 2: RocksDB</a>, where a StateMachine\'s writes end up.</h3>'
                + '<p style="visibility:visible"><a href="https://ratis.apache.org/">ratis.apache.org</a> &middot; '
                + '<a href="https://github.com/apache/ratis/tree/master/ratis-docs/src/site/markdown">Ratis docs</a> &middot; '
                + '<a href="https://raft.github.io/raft.pdf">The Raft Paper</a></p>'
                + '<br/>' + frame.model().controls.html();
            layout.invalidate();
        })
        .after(500, function () {
            frame.model().controls.show();
        });

        player.play();
    };
});
