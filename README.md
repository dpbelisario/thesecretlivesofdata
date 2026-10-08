The Secret Lives of Data
========================

> Understanding what your bits do when you're not looking.

## Overview

So often we use databases and servers without really understanding how they work.
The way that data flows is critical to performance and reliability.

This project seeks to spread the knowledge of our systems through interactive visualization.
If you have a system that you understand and wish to share then please add a [GitHub Issue](https://github.com/benbjohnson/thesecretlivesofdata/issues).
Data visualization knowledge is not necessary -- just the desire to spread some knowledge.


## Visualizations

Below is a list of data visualizations and their associated Github issue.
Please report any bugs you find or any suggestions you have for how to make these visualizations more understandable.

1. [Raft: Understandable Distributed Consensus](http://thesecretlivesofdata.com/raft) ([#1](https://github.com/benbjohnson/thesecretlivesofdata/issues/1))

2. Apache Kafka ([#4](https://github.com/benbjohnson/thesecretlivesofdata/issues/4)) - *Planning*

3. [Apache Ratis: Raft as a Java Library](ratis/) - leader election with pre-vote, the write and read paths,
   partitions, and the `ratis sh` commands that steer leadership, membership and snapshots.

4. [RocksDB: An LSM-Tree Storage Engine](rocksdb/) - the WAL, MemTables, flushes, SST levels, Bloom-filtered
   reads and compaction, the `ldb` / `sst_dump` commands that inspect them, and how a Ratis
   StateMachine stores its state in RocksDB.

Each step of the Ratis and RocksDB walkthroughs shows the command, client API call or config key that
drives it. To view them locally, run `python3 -m http.server` from the repository root and open
`http://localhost:8000/ratis/` or `http://localhost:8000/rocksdb/`. Add `?rate=4` to the URL to play
the animations four times faster.

If you have suggestions for new topics, please submit a new Github issue.
