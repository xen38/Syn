# Read-Only Sessions

Original session files are never copied, moved, modified, duplicated, or deleted. Syn maintains a lightweight metadata database and search index that never touches the original session archives.

All reads are read-only. Indexing only extracts metadata and content for search; it does not write back to source files. Index removal (via "Delete Entry") only removes the entry from the search index; the original archive file on disk is never touched and can be restored by re-indexing.
