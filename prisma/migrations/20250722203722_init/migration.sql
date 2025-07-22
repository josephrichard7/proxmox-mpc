-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "type" TEXT,
    "cpu_usage" REAL,
    "cpu_max" INTEGER,
    "memory_usage" BIGINT,
    "memory_max" BIGINT,
    "uptime" INTEGER,
    "pve_version" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "cpu_cores" INTEGER,
    "cpu_usage" REAL,
    "memory_bytes" BIGINT,
    "memory_usage" BIGINT,
    "disk_size" BIGINT,
    "disk_usage" BIGINT,
    "network_in" BIGINT,
    "network_out" BIGINT,
    "uptime" INTEGER,
    "pid" INTEGER,
    "ha_managed" BOOLEAN NOT NULL DEFAULT false,
    "lock_status" TEXT,
    "config_digest" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vms_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "containers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" TEXT NOT NULL,
    "name" TEXT,
    "hostname" TEXT,
    "status" TEXT NOT NULL,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "cpu_cores" INTEGER,
    "cpu_usage" REAL,
    "memory_bytes" BIGINT,
    "memory_usage" BIGINT,
    "swap_bytes" BIGINT,
    "swap_usage" BIGINT,
    "disk_size" BIGINT,
    "disk_usage" BIGINT,
    "network_in" BIGINT,
    "network_out" BIGINT,
    "uptime" INTEGER,
    "ha_managed" BOOLEAN NOT NULL DEFAULT false,
    "lock_status" TEXT,
    "os_template" TEXT,
    "config_digest" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "containers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "storage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "content_types" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "total_bytes" BIGINT,
    "used_bytes" BIGINT,
    "available_bytes" BIGINT,
    "path" TEXT,
    "nodes" TEXT,
    "config_digest" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tasks" (
    "upid" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "user" TEXT,
    "start_time" DATETIME,
    "end_time" DATETIME,
    "exit_status" TEXT,
    "log_entries" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tasks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "state_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot_time" DATETIME NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_data" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
