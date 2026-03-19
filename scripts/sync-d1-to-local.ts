import { existsSync, mkdirSync, mkdtempSync, readSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const backupBaseDir = path.join(repoRoot, "backups", "d1-sync");

type DbTarget = "stocks" | "crypto";

interface DbConfig {
  label: DbTarget;
  remoteName: string;
  localBinding: string;
  schemaTables: string[];
  resetTables: string[];
  schemaProbeTable: string;
}

interface ParsedOptions {
  target: DbTarget | "all";
  dryRun: boolean;
  keepExport: boolean;
  yes: boolean;
  help: boolean;
}

interface RunOptions {
  dryRun?: boolean;
  captureOutput?: boolean;
}

const dbConfigs: Record<DbTarget, DbConfig> = {
  stocks: {
    label: "stocks",
    remoteName: "china-stocks-daily",
    localBinding: "STOCKS_DB",
    schemaTables: ["stocks", "report_runs", "report_quotes", "report_news", "market_index_snapshots", "market_ai_summaries"],
    resetTables: ["report_news", "report_quotes", "report_runs", "market_ai_summaries", "market_index_snapshots", "stocks"],
    schemaProbeTable: "stocks"
  },
  crypto: {
    label: "crypto",
    remoteName: "crypto-daily",
    localBinding: "CRYPTO_DB",
    schemaTables: [
      "coins",
      "daily_reports",
      "daily_coin_snapshots",
      "crypto_news_raw",
      "crypto_news_items",
      "crypto_news_item_coins",
      "crypto_news_item_topics",
      "crypto_news_clusters",
      "crypto_news_cluster_members"
    ],
    resetTables: [
      "crypto_news_cluster_members",
      "crypto_news_clusters",
      "crypto_news_item_topics",
      "crypto_news_item_coins",
      "crypto_news_items",
      "crypto_news_raw",
      "daily_coin_snapshots",
      "daily_reports",
      "coins"
    ],
    schemaProbeTable: "coins"
  }
};

function usage() {
  console.log(`Usage:
  pnpm db:sync:local -- <stocks|crypto|all> [--dry-run] [--yes] [--keep-export]

Options:
  --dry-run      Print the Wrangler commands without executing them.
  --yes          Skip the destructive confirmation prompt.
  --keep-export  Keep exported SQL files instead of deleting the temp directory.

Examples:
  pnpm db:sync:local -- all --dry-run
  pnpm db:sync:local -- stocks --yes
  pnpm db:sync:local:crypto
`);
}

function parseArgs(argv: string[]): ParsedOptions {
  const positionals = [];
  const flags = new Set();

  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }

    if (arg === "-h") {
      flags.add(arg);
      continue;
    }

    if (arg.startsWith("--")) {
      flags.add(arg);
    } else {
      positionals.push(arg);
    }
  }

  const targetInput = positionals[0] ?? "all";
  if (!["stocks", "crypto", "all"].includes(targetInput)) {
    throw new Error(`Unknown target '${targetInput}'. Expected stocks, crypto, or all.`);
  }
  const target = targetInput as ParsedOptions["target"];

  return {
    target,
    dryRun: flags.has("--dry-run"),
    keepExport: flags.has("--keep-export"),
    yes: flags.has("--yes"),
    help: flags.has("--help") || flags.has("-h")
  };
}

function resolveRunnerCommand(): string {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function resolveSpawnCommand(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args]
    };
  }

  return { command, args };
}

function stringifyCommand(command: string, args: string[]): string {
  return [command, ...args]
    .map((part) => (/[\s"]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function runCommand(command: string, args: string[], options: RunOptions = {}) {
  const printable = stringifyCommand(command, args);
  const spawned = resolveSpawnCommand(command, args);
  console.log(`\n> ${printable}`);

  if (options.dryRun) {
    return { status: 0, stdout: "", stderr: "" };
  }

  const result = spawnSync(spawned.command, spawned.args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.captureOutput) {
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }
    }
    throw new Error(`Command failed with exit code ${result.status}: ${printable}`);
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function wranglerArgs(args: string[]): string[] {
  return ["exec", "wrangler", ...args, "--config", "apps/api/wrangler.toml"];
}

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function createTimestampLabel() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function localTableExists(dbConfig: DbConfig): boolean {
  return getExistingLocalTables(dbConfig).includes(dbConfig.schemaProbeTable);
}

function getExistingLocalTables(dbConfig: DbConfig): string[] {
  const runnerCommand = resolveRunnerCommand();
  const runnerArgs = wranglerArgs([
    "d1",
    "execute",
    dbConfig.localBinding,
    "--local",
    "--yes",
    "--json",
    "--command",
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
  ]);
  const spawned = resolveSpawnCommand(runnerCommand, runnerArgs);
  const result = spawnSync(
    spawned.command,
    spawned.args,
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  if (result.status !== 0) {
    return [];
  }

  try {
    const payload = JSON.parse(result.stdout ?? "[]");
    const rows = Array.isArray(payload) && payload[0] && Array.isArray(payload[0].results) ? payload[0].results : [];
    return rows
      .map((row: { name?: unknown }) => (typeof row?.name === "string" ? row.name : null))
      .filter((name: string | null): name is string => Boolean(name));
  } catch {
    return [];
  }
}

function exportSchemaIfNeeded(dbConfig: DbConfig, schemaFilePath: string, dryRun: boolean, existingTables: string[]): boolean {
  const missingSchemaTables = dbConfig.schemaTables.filter((table) => !existingTables.includes(table));

  if (!dryRun && missingSchemaTables.length === 0) {
    return false;
  }

  const runnerCommand = resolveRunnerCommand();
  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "export",
      dbConfig.remoteName,
      "--remote",
      "--output",
      schemaFilePath,
      "--no-data"
    ]),
    { dryRun }
  );

  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "execute",
      dbConfig.localBinding,
      "--local",
      "--yes",
      "--file",
      schemaFilePath
    ]),
    { dryRun }
  );

  return true;
}

function buildDropSql(dbConfig: DbConfig, existingTables: string[]): string {
  const tablesToDrop = [...dbConfig.resetTables].reverse().filter((table) => existingTables.includes(table));

  if (tablesToDrop.length === 0) {
    return "PRAGMA foreign_keys = ON;\n";
  }

  const lines = ["PRAGMA foreign_keys = OFF;", "BEGIN TRANSACTION;"];

  for (const table of tablesToDrop) {
    lines.push(`DROP TABLE IF EXISTS \"${table}\";`);
  }

  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys = ON;");

  return `${lines.join("\n")}\n`;
}

function buildResetSql(dbConfig: DbConfig, existingTables: string[]): string {
  const tablesToReset = dbConfig.resetTables.filter((table) => existingTables.includes(table));

  if (tablesToReset.length === 0) {
    return "PRAGMA foreign_keys = ON;\n";
  }

  const quotedTableNames = tablesToReset.map((table) => `'${table}'`).join(", ");
  const lines = ["PRAGMA foreign_keys = OFF;", "BEGIN TRANSACTION;"];

  for (const table of tablesToReset) {
    lines.push(`DELETE FROM \"${table}\";`);
  }

  lines.push(`DELETE FROM sqlite_sequence WHERE name IN (${quotedTableNames});`);
  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys = ON;");

  return `${lines.join("\n")}\n`;
}

function writeFileForImport(filePath: string, content: string): void {
  ensureDirectory(path.dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}

function confirmDestructiveRun(target: string): void {
  const message = `This will overwrite local D1 data for '${target}'. Continue? [y/N] `;
  process.stdout.write(message);
  const buffer = Buffer.alloc(1024);
  const bytesRead = process.stdin.fd ? readSync(process.stdin.fd, buffer, 0, buffer.length, null) : 0;
  const answer = buffer.toString("utf8", 0, bytesRead).trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    throw new Error("Cancelled.");
  }
}

function syncOneDatabase(dbConfig: DbConfig, options: ParsedOptions, exportRootDir: string, backupDir: string): void {
  const schemaFilePath = path.join(exportRootDir, `${dbConfig.label}.schema.sql`);
  const dataFilePath = path.join(exportRootDir, `${dbConfig.label}.data.sql`);
  const resetFilePath = path.join(exportRootDir, `${dbConfig.label}.reset.sql`);
  const backupFilePath = path.join(backupDir, `${dbConfig.label}.local-backup.sql`);
  const runnerCommand = resolveRunnerCommand();
  const existingTables = options.dryRun ? dbConfig.schemaTables : getExistingLocalTables(dbConfig);
  const missingSchemaTables = dbConfig.schemaTables.filter((table) => !existingTables.includes(table));

  console.log(`\n== Syncing ${dbConfig.label} ==`);

  ensureDirectory(backupDir);
  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "export",
      dbConfig.remoteName,
      "--local",
      "--output",
      backupFilePath
    ]),
    { dryRun: options.dryRun }
  );

  writeFileForImport(
    resetFilePath,
    missingSchemaTables.length > 0 ? buildDropSql(dbConfig, existingTables) : buildResetSql(dbConfig, existingTables)
  );
  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "execute",
      dbConfig.localBinding,
      "--local",
      "--yes",
      "--file",
      resetFilePath
    ]),
    { dryRun: options.dryRun }
  );

  exportSchemaIfNeeded(dbConfig, schemaFilePath, options.dryRun, missingSchemaTables.length > 0 ? [] : existingTables);

  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "export",
      dbConfig.remoteName,
      "--remote",
      "--output",
      dataFilePath,
      "--no-schema"
    ]),
    { dryRun: options.dryRun }
  );

  runCommand(
    runnerCommand,
    wranglerArgs([
      "d1",
      "execute",
      dbConfig.localBinding,
      "--local",
      "--yes",
      "--file",
      dataFilePath
    ]),
    { dryRun: options.dryRun }
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  const selectedConfigs = options.target === "all" ? [dbConfigs.stocks, dbConfigs.crypto] : [dbConfigs[options.target]];
  const exportRootDir = mkdtempSync(path.join(tmpdir(), "china-stocks-d1-sync-"));
  const backupDir = path.join(backupBaseDir, createTimestampLabel());

  if (!options.dryRun && !options.yes) {
    confirmDestructiveRun(options.target);
  }

  try {
    for (const dbConfig of selectedConfigs) {
      syncOneDatabase(dbConfig, options, exportRootDir, backupDir);
    }

    console.log(`\nDone. Temporary SQL files are in: ${exportRootDir}`);
    console.log(`Local D1 backups are in: ${backupDir}`);
    if (!options.keepExport && !options.dryRun) {
      rmSync(exportRootDir, { recursive: true, force: true });
      console.log("Temporary SQL files removed.");
    }
  } catch (error) {
    console.error(`\nSync failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Temporary SQL files kept at: ${exportRootDir}`);
    process.exitCode = 1;
  }
}

main();
