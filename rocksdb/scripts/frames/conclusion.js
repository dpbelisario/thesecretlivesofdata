"use strict";
/*jslint browser: true, nomen: true*/
/*global define*/

define([], function () {
    return function (frame) {
        var layout = frame.layout(),
            row = function (cmd, what) {
                return '<li><code>' + cmd + '</code> &mdash; ' + what + '</li>';
            };

        frame.after(1, function () {
            frame.model().clear();
            layout.invalidate();
        })

        .after(500, function () {
            frame.model().title = '<h2 style="visibility:visible">ldb &amp; sst_dump cheat sheet</h2>'
                + '<ul class="cheatsheet" style="visibility:visible">'
                + row('ldb --db=DIR get KEY', 'read one key (opens read-only)')
                + row('ldb --db=DIR scan [--from=A] [--to=B] [--max_keys=N]', 'iterate a key range (--to is exclusive)')
                + row('ldb --db=DIR put KEY VALUE [--create_if_missing]', 'write (service must be stopped: LOCK)')
                + row('ldb --db=DIR delete KEY', 'write a tombstone')
                + row('ldb dump_wal --walfile=DIR/000003.log --print_value', 'records waiting in a WAL file')
                + row('ldb manifest_dump --path=DIR/MANIFEST-000005', 'live files and levels, from the MANIFEST')
                + row('ldb --db=DIR get_property rocksdb.stats', 'per-level sizes, write amplification, stalls')
                + row('ldb --db=DIR get_property rocksdb.num-files-at-level0', 'is L0 piling up?')
                + row('ldb --db=DIR compact [--from=A] [--to=B]', 'manual CompactRange()')
                + row('ldb --db=DIR checkpoint --checkpoint_dir=OUT', 'hard-linked copy (backups, Ratis snapshots)')
                + row('ldb --db=DIR list_column_families', 'column families in the DB')
                + row('sst_dump --file=F.sst --command=scan|check|verify|raw', 'inspect or verify one SST file')
                + row('sst_dump --file=F.sst --show_properties', 'entries, sizes, filter and compression info')
                + '</ul>'
                + '<p style="visibility:visible">Most commands also take <code>--column_family=NAME</code>. Defaults shown in this guide: '
                + '<code>write_buffer_size</code> 64 MB, <code>level0_file_num_compaction_trigger</code> 4, '
                + '<code>max_bytes_for_level_base</code> 256 MB, <code>max_bytes_for_level_multiplier</code> 10.</p>'
                + '<h3 style="visibility:visible">Back to <a href="../ratis/">Part 1: Apache Ratis</a></h3>'
                + '<p style="visibility:visible"><a href="https://github.com/facebook/rocksdb/wiki">RocksDB wiki</a> &middot; '
                + '<a href="https://github.com/facebook/rocksdb/wiki/Administration-and-Data-Access-Tool">ldb &amp; sst_dump docs</a></p>'
                + '<br/>' + frame.model().controls.html();
            layout.invalidate();
        })
        .after(500, function () {
            frame.model().controls.show();
        });

        frame.player().play();
    };
});
