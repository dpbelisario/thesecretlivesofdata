"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define(["./title", "./overview", "./writes", "./flush", "./reads", "./compaction", "./together", "./conclusion"],
    function (title, overview, writes, flush, reads, compaction, together, conclusion) {
        return function (player) {
            player.frame("home", "Home", title);
            player.frame("overview", "What is RocksDB?", overview);
            player.frame("writes", "The Write Path: WAL & MemTable", writes);
            player.frame("flush", "Flush: MemTable to SST", flush);
            player.frame("reads", "The Read Path & Bloom Filters", reads);
            player.frame("compaction", "Compaction", compaction);
            player.frame("together", "Ratis + RocksDB", together);
            player.frame("conclusion", "Command Cheat Sheet", conclusion);
        };
    });
