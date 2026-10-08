"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./title", "./overview", "./election", "./replication", "./leadership", "./membership", "./snapshot", "./conclusion"],
    function (title, overview, election, replication, leadership, membership, snapshot, conclusion) {
        return function (player) {
            player.frame("home", "Home", title);
            player.frame("overview", "What is Ratis?", overview);
            player.frame("election", "Leader Election & Pre-Vote", election);
            player.frame("replication", "Writes, Reads & Partitions", replication);
            player.frame("leadership", "Steering Leadership (ratis sh election)", leadership);
            player.frame("membership", "Adding & Removing Peers (ratis sh peer)", membership);
            player.frame("snapshot", "Snapshots (ratis sh snapshot)", snapshot);
            player.frame("conclusion", "Command Cheat Sheet", conclusion);
        };
    });
