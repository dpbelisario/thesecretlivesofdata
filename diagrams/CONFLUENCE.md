# Apache Ratis & RocksDB, in Diagrams

Static frames from the interactive walkthroughs in this repo (`/ratis` and `/rocksdb`). Each image shows
the step, the command / API / config that drives it, and what happens.

**Example cluster used throughout:** `PEERS=n0:9872,n1:9872,n2:9872`, RocksDB at `/data/db`.

Upload the PNGs from `diagrams/ratis/` and `diagrams/rocksdb/` as page attachments, then insert them in
the order below. Each image already has its caption and command in it; the one-liners here are optional
captions for the page.

---

## Part 1: Apache Ratis

Ratis is a Java library that implements Raft. You embed it in your service. Writes and reads go through
`RaftClient`; topology, leadership and snapshots go through the admin API, which `ratis sh` wraps.

| # | Image | What it shows |
|---|---|---|
| 1 | `ratis/01-overview-four-surfaces.png` | Peers, a RaftGroup, your StateMachine, the client and the `ratis sh` operator |
| 2 | `ratis/02-election-pre-vote.png` | Pre-vote: a follower asks "would you vote for me?" without bumping its term |
| 3 | `ratis/03-election-leader-elected.png` | Majority of votes, so a leader; `notifyLeaderChanged()` / `notifyLeaderReady()` |
| 4 | `ratis/04-election-isolated-peer.png` | Why pre-vote: a cut-off peer retries forever but its term doesn't climb |
| 5 | `ratis/05-write-start-transaction.png` | `client.io().send()` → leader `startTransaction()` → uncommitted log entry |
| 6 | `ratis/06-write-committed-apply.png` | Majority stored it, so it's committed and `applyTransaction()` runs |
| 7 | `ratis/07-partition-leader-steps-down.png` | A Ratis leader that loses its majority steps down (`LOST_MAJORITY_HEARTBEATS`) |
| 8 | `ratis/08-sh-election-transfer.png` | `ratis sh election transfer` → `transferLeadership` → StartLeaderElection |
| 9 | `ratis/09-sh-election-pause.png` | `ratis sh election pause`: the peer follows but never campaigns |
| 10 | `ratis/10-sh-election-stepdown.png` | `ratis sh election stepDown` and the step-down wait time |
| 11 | `ratis/11-sh-peer-add-start-empty.png` | Adding a peer, step 1: start it with the group id and an empty peer list |
| 12 | `ratis/12-sh-peer-add-joint-consensus.png` | `ratis sh peer add`: joint configuration C(old,new) |
| 13 | `ratis/13-sh-peer-add-done.png` | C(new) committed: the new peer is a voting member |
| 14 | `ratis/14-sh-peer-remove.png` | `ratis sh peer remove`: the removed peer shuts itself down |
| 15 | `ratis/15-sh-snapshot-create.png` | `ratis sh snapshot create` → `takeSnapshot()` → log purge; on-disk layout |
| 16 | `ratis/16-install-snapshot.png` | A lagging peer gets the snapshot via InstallSnapshot |
| 17 | `ratis/17-ratis-sh-cheat-sheet.png` | All `ratis sh` commands (also as a table below) |

### `ratis sh` cheat sheet

Every command takes `-peers h:p,h:p,...` and optional `-groupid <uuid>`. `-D<key>=<value>` sets client properties.

| Command | Admin API underneath | What it does |
|---|---|---|
| `ratis sh group info -peers $PEERS` | `GroupManagementApi.info()` | Leader, per-peer commit index, log info |
| `ratis sh group list -peers $PEERS -peerId n0` | `GroupManagementApi.list()` | Groups a server belongs to (multi-Raft) |
| `ratis sh election transfer -peers $PEERS -address n2:9872 [-timeout s]` | `setConfiguration` (raise priority if needed) + `transferLeadership` | Move leadership to a peer |
| `ratis sh election stepDown -peers $PEERS` | `transferLeadership(null, leader)` | Current leader steps aside |
| `ratis sh election pause -peers $PEERS -address n0:9872` | `LeaderElectionManagementApi.pause()` | Peer never starts an election |
| `ratis sh election resume -peers $PEERS -address n0:9872` | `LeaderElectionManagementApi.resume()` | Undo pause |
| `ratis sh peer add -peers $PEERS -peerId n3 -address n3:9872` | `setConfiguration(old + new)` | Joint-consensus add |
| `ratis sh peer remove -peers $PEERS -peerId n1` | `setConfiguration(old - removed)` | Joint-consensus remove |
| `ratis sh peer setPriority -peers $PEERS -addressPriority "n2:9872\|2"` | `setConfiguration(new priorities)` | Prefer a leader |
| `ratis sh snapshot create -peers $PEERS -peerId n1` | `SnapshotManagementApi.create()` | `takeSnapshot()` on one peer |
| `ratis sh local raftMetaConf -peers "n0\|h0:p,..." -path <dir>` | none (offline) | Rewrite `raft-meta.conf` to move a peer to a new address |

**Gotcha:** with only `-address`, the shell assumes the peer id is `host_port`. If your ids are names
like `n1`, pass `-peerId`.

---

## Part 2: RocksDB

RocksDB is an embedded LSM-tree key-value store. Writes go to the WAL and an in-memory MemTable; full
MemTables are flushed to immutable SST files in levels, and compaction merges them down.

| # | Image | What it shows |
|---|---|---|
| 1 | `rocksdb/01-overview-ldb-sst-dump.png` | MemTable, WAL, levels, and the `ldb` / `sst_dump` tools |
| 2 | `rocksdb/02-write-wal-append.png` | `db->Put()`: WAL append first, sequence number #1 |
| 3 | `rocksdb/03-write-memtable-insert.png` | Then MemTable insert; the write is done |
| 4 | `rocksdb/04-write-delete-tombstone.png` | Overwrites add versions; deletes add tombstones |
| 5 | `rocksdb/05-write-batch.png` | `WriteBatch`: one WAL record, atomic |
| 6 | `rocksdb/06-flush-immutable-memtable.png` | Full MemTable becomes immutable; new MemTable + WAL (`write_buffer_size`) |
| 7 | `rocksdb/07-flush-to-l0.png` | Flush to an L0 SST file; the old WAL is deleted |
| 8 | `rocksdb/08-flush-l0-overlap.png` | L0 files overlap; `get_property rocksdb.num-files-at-level0` |
| 9 | `rocksdb/09-read-bloom-filters.png` | `db->Get()`: newest first, Bloom filters skip files |
| 10 | `rocksdb/10-read-tombstone-not-found.png` | A tombstone means "Key not found" |
| 11 | `rocksdb/11-read-snapshot.png` | `GetSnapshot()`: reads ignore newer writes |
| 12 | `rocksdb/12-compaction-inputs.png` | 4 L0 files trigger compaction: all L0 + overlapping L1 |
| 13 | `rocksdb/13-compaction-l1-output.png` | New non-overlapping L1 files; tombstones dropped |
| 14 | `rocksdb/14-compaction-l2.png` | L1 → L2, one file at a time |
| 15 | `rocksdb/15-ratis-statemachine-writebatch.png` | Ratis `applyTransaction()` writes a WriteBatch with the applied index |
| 16 | `rocksdb/16-ratis-snapshot-checkpoint.png` | Ratis `takeSnapshot()` as a RocksDB checkpoint (hard links) |
| 17 | `rocksdb/17-ldb-sst-dump-cheat-sheet.png` | All `ldb` / `sst_dump` commands (also as a table below) |

### `ldb` / `sst_dump` cheat sheet

Read commands (`get`, `scan`, dumps) open the DB read-only and work on a live DB. Write commands
(`put`, `delete`, `compact`) need the DB's LOCK, so stop the service first.

| Command | What it does |
|---|---|
| `ldb --db=/data/db get KEY` | Read one key |
| `ldb --db=/data/db scan [--from=A] [--to=B] [--max_keys=N]` | Iterate a range (`--to` is exclusive) |
| `ldb --db=/data/db put KEY VALUE [--create_if_missing]` | Write a key |
| `ldb --db=/data/db delete KEY` | Write a tombstone |
| `ldb dump_wal --walfile=/data/db/000003.log --print_value` | Records in a WAL file |
| `ldb manifest_dump --path=/data/db/MANIFEST-000005` | Live files and levels |
| `ldb --db=/data/db get_property rocksdb.stats` | Per-level sizes, write amplification, stalls |
| `ldb --db=/data/db get_property rocksdb.num-files-at-level0` | Is L0 piling up? |
| `ldb --db=/data/db compact [--from=A] [--to=B]` | Manual `CompactRange()` |
| `ldb --db=/data/db checkpoint --checkpoint_dir=OUT` | Hard-linked copy (backups, Ratis snapshots) |
| `ldb --db=/data/db list_column_families` | Column families |
| `sst_dump --file=F.sst --command=scan\|check\|verify\|raw` | Inspect or verify one SST file |
| `sst_dump --file=F.sst --show_properties` | Entries, sizes, filter/compression info |

### Key defaults

| Option | Default | Meaning |
|---|---|---|
| `write_buffer_size` | 64 MB | MemTable size before it's switched out |
| `max_write_buffer_number` | 2 | MemTables in memory (active + immutable) |
| `level0_file_num_compaction_trigger` | 4 | L0 files that trigger compaction |
| `level0_slowdown_writes_trigger` / `level0_stop_writes_trigger` | 20 / 36 | Write stalls |
| `max_bytes_for_level_base` | 256 MB | L1 target size |
| `max_bytes_for_level_multiplier` | 10 | Each level ~10× the one above |

---

*Commands, flags and defaults were checked against the apache/ratis and facebook/rocksdb source
(Oct 2026). `ratis-shell` is still marked experimental upstream. Diagrams are simplified (e.g. ~3 keys per SST).*
