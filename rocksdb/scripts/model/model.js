"use strict";
/*jslint browser: true, nomen: true*/
/*global define, playback, tsld*/

/**
 * A toy RocksDB: one column family with a MemTable, immutable MemTables,
 * a write-ahead log and leveled SST files. Every operation is a plain state
 * change; the frames animate between them.
 */
define(["./controls", "./client", "./message"], function (Controls, Client, Message) {
    var MAX_SST_KEYS = 3;

    function Model() {
        playback.Model.call(this);

        this.title = "";
        this.subtitle = "";
        this.defaultNetworkLatency = Model.DEFAULT_LATENCY;
        this.controls = new Controls(this);
        this.clients = new playback.Set(this, Client);
        this.messages = new playback.Set(this, Message);
        this.bbox = tsld.bbox(0, 100, 100, 0);
        this.domains = {x: [0, 100], y: [0, 100]};
        this.anchors = {};
        this.reset();
    }

    Model.prototype = new playback.Model();
    Model.prototype.constructor = Model;

    Model.DEFAULT_LATENCY = 700;

    /**
     * Clears the database and any highlights.
     */
    Model.prototype.reset = function () {
        this.db = {
            seq: 0,
            fileNo: 3,
            walNo: 3,
            mem: {id: "mem-1", log: 3, entries: []},
            nextMem: 2,
            imm: [],
            wal: [],
            levels: [[], [], []],
            snapshot: null,
            checkpoint: null,
            visible: {wal: true, levels: true},
        };
        this.highlights = {};
        this.badges = {};
        this.notes = {};
    };

    Model.prototype.find = function (id) {
        return this.clients.find(id);
    };

    Model.prototype.tick = function (t) {
        this.messages.filter(function (message) {
            return (message.recvTime > t);
        });
    };

    /**
     * Sends an animated message between two anchors (client ids or box ids).
     */
    Model.prototype.send = function (source, target, payload, callback, latency) {
        var message = this.messages.create();
        latency = (latency !== undefined ? latency : this.defaultNetworkLatency);
        message.payload = (payload !== undefined ? payload : null);
        message.source = source;
        message.target = target;
        message.sendTime = this.playhead();
        message.recvTime = message.sendTime + latency;
        if (callback) {
            this.frame().after(latency, callback);
        }
        return message;
    };

    Model.prototype.clear = function () {
        this.title = this.subtitle = "";
        this.clients.removeAll();
        this.messages.removeAll();
        this.reset();
    };

    //----------------------------------
    // Database operations
    //----------------------------------

    function byKeyThenNewest(a, b) {
        if (a.k !== b.k) {
            return a.k < b.k ? -1 : 1;
        }
        return b.seq - a.seq;
    }

    Model.prototype.walRecord = function (text) {
        var rec = {id: "wal-" + this.db.seq, seq: this.db.seq, text: text, log: this.db.walNo};
        this.db.wal.push(rec);
        return rec;
    };

    /** db->Put(): WAL first, then the MemTable. */
    Model.prototype.put = function (k, v) {
        this.db.seq += 1;
        this.walRecord("put " + k + "=" + v);
        return this.memInsert({k: k, v: v, seq: this.db.seq});
    };

    /** db->Delete(): writes a tombstone. */
    Model.prototype.del = function (k) {
        this.db.seq += 1;
        this.walRecord("del " + k);
        return this.memInsert({k: k, del: true, seq: this.db.seq});
    };

    /** db->Write(WriteBatch): one WAL record, consecutive sequence numbers. */
    Model.prototype.writeBatch = function (ops) {
        var self = this, first = this.db.seq + 1;
        ops.forEach(function (op) {
            self.db.seq += 1;
            self.memInsert(op[1] === null ? {k: op[0], del: true, seq: self.db.seq} : {k: op[0], v: op[1], seq: self.db.seq});
        });
        this.db.wal.push({id: "wal-" + first, seq: first, text: "batch x" + ops.length, log: this.db.walNo});
    };

    Model.prototype.memInsert = function (entry) {
        this.db.mem.entries.push(entry);
        this.db.mem.entries.sort(byKeyThenNewest);
        return entry;
    };

    /** The MemTable is full: it becomes immutable and a new one (and WAL) starts. */
    Model.prototype.switchMemtable = function () {
        this.db.imm.unshift(this.db.mem);
        this.db.fileNo += 1;
        this.db.walNo = this.db.fileNo;
        this.db.mem = {id: "mem-" + this.db.nextMem, log: this.db.walNo, entries: []};
        this.db.nextMem += 1;
    };

    /** Keeps only the newest version of each key. */
    function newestOnly(entries) {
        var seen = {}, out = [];
        entries.slice().sort(byKeyThenNewest).forEach(function (e) {
            if (!seen[e.k]) {
                seen[e.k] = true;
                out.push(e);
            }
        });
        return out;
    }

    Model.prototype.newSst = function (entries, level) {
        this.db.fileNo += 1;
        var num = ("000000" + this.db.fileNo).slice(-6);
        return {id: num + ".sst", level: level, entries: entries,
                min: entries[0].k, max: entries[entries.length - 1].k};
    };

    /** Flushes the oldest immutable MemTable to a new L0 file. */
    Model.prototype.flush = function () {
        var mem = this.db.imm.pop(), sst;
        if (!mem) {
            return null;
        }
        sst = this.newSst(newestOnly(mem.entries), 0);
        this.db.levels[0].unshift(sst);
        this.db.wal = this.db.wal.filter(function (rec) { return rec.log !== mem.log; });
        return sst;
    };

    function overlaps(sst, min, max) {
        return !(sst.max < min || sst.min > max);
    }

    /**
     * Picks the inputs for compacting `level` into `level + 1`:
     * every L0 file (they overlap), or one file from L1+, plus the
     * overlapping files of the next level.
     */
    Model.prototype.compactionInputs = function (level) {
        var upper = (level === 0 ? this.db.levels[0].slice() : this.db.levels[level].slice(0, 1)),
            min, max, lower;
        if (upper.length === 0) {
            return [];
        }
        min = upper.map(function (f) { return f.min; }).sort()[0];
        max = upper.map(function (f) { return f.max; }).sort().pop();
        lower = this.db.levels[level + 1].filter(function (f) { return overlaps(f, min, max); });
        return upper.concat(lower);
    };

    /** Merges the inputs into new, non-overlapping files on level + 1. */
    Model.prototype.compact = function (level) {
        var self = this,
            inputs = this.compactionInputs(level),
            ids = inputs.map(function (f) { return f.id; }),
            all = [],
            merged,
            out = [],
            i;
        if (inputs.length === 0) {
            return [];
        }
        inputs.forEach(function (f) { all = all.concat(f.entries); });
        merged = newestOnly(all).filter(function (e) {
            // A tombstone can go once nothing older can exist below it.
            return !(e.del && !self.keyBelow(e.k, level + 1));
        });
        this.db.levels[level] = this.db.levels[level].filter(function (f) { return ids.indexOf(f.id) === -1; });
        this.db.levels[level + 1] = this.db.levels[level + 1].filter(function (f) { return ids.indexOf(f.id) === -1; });
        for (i = 0; i < merged.length; i += MAX_SST_KEYS) {
            out.push(this.newSst(merged.slice(i, i + MAX_SST_KEYS), level + 1));
        }
        this.db.levels[level + 1] = this.db.levels[level + 1].concat(out)
            .sort(function (a, b) { return a.min < b.min ? -1 : 1; });
        return out;
    };

    /** Whether any file below `level` could hold `k`. */
    Model.prototype.keyBelow = function (k, level) {
        var l;
        for (l = level + 1; l < this.db.levels.length; l += 1) {
            if (this.db.levels[l].some(function (f) { return overlaps(f, k, k); })) {
                return true;
            }
        }
        return false;
    };

    /**
     * Plans a db->Get(): returns the boxes looked at in order, each with
     * what happened there: "hit", "miss" (searched, not there),
     * "bloom" (range matched but the Bloom filter said no) or "found-del".
     */
    Model.prototype.planGet = function (k, maxSeq) {
        var steps = [], done = false, l,
            visible = function (e) { return e.k === k && (maxSeq === undefined || maxSeq === null || e.seq <= maxSeq); },
            look = function (id, entries, isSst) {
                var e;
                if (done) {
                    return;
                }
                e = entries.filter(visible).sort(byKeyThenNewest)[0];
                if (e) {
                    steps.push({id: id, result: e.del ? "found-del" : "hit", entry: e});
                    done = true;
                } else {
                    steps.push({id: id, result: isSst ? "bloom" : "miss"});
                }
            };
        look(this.db.mem.id, this.db.mem.entries, false);
        this.db.imm.forEach(function (m) { look(m.id, m.entries, false); });
        for (l = 0; l < this.db.levels.length; l += 1) {
            this.db.levels[l].forEach(function (f) {
                if (overlaps(f, k, k)) {
                    look(f.id, f.entries, true);
                }
            });
        }
        return steps;
    };

    /** Checkpoint::CreateCheckpoint(): hard-links the live SST files. */
    Model.prototype.checkpoint = function (dir) {
        var files = [];
        this.db.levels.forEach(function (lv) { lv.forEach(function (f) { files.push(f.id); }); });
        this.db.checkpoint = {dir: dir, files: files};
    };

    //----------------------------------
    // What to draw
    //----------------------------------

    Model.LAYOUT = {
        memX: 15, memY: 3, memW: 21, immStep: 24,
        walX: 15, walY: 37, walW: 9.5, walStep: 10.5,
        levelY: [46, 63, 80], fileX: 15, fileW: 14, fileStep: 16,
        cpX: 82, cpW: 16,
    };

    function entryText(e) {
        return (e.del ? "del " + e.k : e.k + "=" + e.v) + "  #" + e.seq;
    }

    /**
     * Returns the boxes to draw: [{id, x, y, w, title, sub, lines, kind}].
     */
    Model.prototype.boxes = function () {
        var L = Model.LAYOUT,
            db = this.db,
            boxes = [],
            memLines = function (m) {
                var lines = m.entries.map(entryText);
                return lines.length > 7 ? lines.slice(0, 6).concat(["... +" + (lines.length - 6)]) : lines;
            };

        if (db.visible.mem !== false) {
            boxes.push({id: db.mem.id, kind: "mem", x: L.memX, y: L.memY, w: L.memW,
                        title: "MemTable", sub: "WAL " + ("000000" + db.mem.log).slice(-6) + ".log",
                        lines: memLines(db.mem)});
        }
        db.imm.forEach(function (m, i) {
            boxes.push({id: m.id, kind: "imm", x: L.memX + L.immStep * (i + 1), y: L.memY, w: L.memW,
                        title: "Immutable MemTable", sub: "waiting to flush",
                        lines: memLines(m)});
        });
        if (db.visible.wal) {
            db.wal.slice(-7).forEach(function (rec, i) {
                boxes.push({id: rec.id, kind: "wal", x: L.walX + L.walStep * i, y: L.walY, w: L.walW,
                            title: null, sub: null, lines: [rec.text]});
            });
        }
        if (db.visible.levels) {
            db.levels.forEach(function (files, level) {
                files.slice(0, 5).forEach(function (f, i) {
                    var lines = f.entries.map(entryText);
                    boxes.push({id: f.id, kind: "sst", x: L.fileX + L.fileStep * i, y: L.levelY[level], w: L.fileW,
                                title: f.id, sub: "[" + f.min + " .. " + f.max + "]",
                                lines: lines.length > 3 ? lines.slice(0, 2).concat(["... +" + (lines.length - 2)]) : lines});
                });
            });
        }
        if (db.checkpoint) {
            boxes.push({id: "checkpoint", kind: "checkpoint", x: L.cpX, y: L.levelY[0], w: L.cpW,
                        title: db.checkpoint.dir, sub: "hard links", lines: db.checkpoint.files});
        }
        return boxes;
    };

    /**
     * Returns static labels: [{id, x, y, text, size, anchor, color}].
     */
    Model.prototype.labels = function () {
        var L = Model.LAYOUT, labels = [], walFiles = {};
        if (this.db.visible.wal) {
            this.db.wal.forEach(function (r) { walFiles[r.log] = true; });
            labels.push({id: "lbl-wal", x: 8, ax: L.walX + 35, y: L.walY + 2.5, text: "WAL", size: 6});
            labels.push({id: "lbl-wal-files", x: L.walX, y: L.walY - 1.5, size: 4.5, anchor: "start", color: "#777",
                         text: "on disk: " + (Object.keys(walFiles).length ? Object.keys(walFiles).map(function (n) { return ("000000" + n).slice(-6) + ".log"; }).join("  ") : "(empty)")});
        }
        if (this.db.visible.levels) {
            ["L0", "L1", "L2"].forEach(function (name, i) {
                labels.push({id: "lbl-" + name, x: 8, ax: L.fileX + 30, y: L.levelY[i] + 3, text: name, size: 7});
            });
        }
        if (this.db.snapshot !== null) {
            labels.push({id: "lbl-snapshot", x: L.memX, y: L.memY - 1.5 + 0.01, size: 4.5, anchor: "start", color: "purple",
                         text: "snapshot pinned at #" + this.db.snapshot});
        }
        return labels;
    };

    Model.prototype.clone = function () {
        var clone = new Model();
        clone._player = this._player;
        clone.title = this.title;
        clone.subtitle = this.subtitle;
        clone.clients = this.clients.clone(clone);
        clone.messages = this.messages.clone(clone);
        clone.db = JSON.parse(JSON.stringify(this.db));
        clone.highlights = JSON.parse(JSON.stringify(this.highlights));
        clone.badges = JSON.parse(JSON.stringify(this.badges));
        clone.notes = JSON.parse(JSON.stringify(this.notes));
        clone.defaultNetworkLatency = this.defaultNetworkLatency;
        return clone;
    };

    return Model;
});
