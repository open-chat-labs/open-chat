import { invoke } from "@tauri-apps/api/core";

// What the Android shell kept of its own crashes, ANRs and kills (NativeExitReports.kt). No
// exception messages: class names and frames only.
export type NativeExitReport =
    | {
          kind: "exit";
          timestamp: number;
          // crash, crash_native, anr, low_memory, ...
          reason: string;
          importance: number;
          status: number;
          // The main thread's frames, for an ANR
          stack?: string;
          shellVersion?: string;
      }
    | {
          kind: "uncaught";
          timestamp: number;
          exceptionClass: string;
          thread: string;
          stack: string;
          shellVersion?: string;
      };

type ErrorLogger = { logError(message: unknown, error: unknown): void };

function title(report: NativeExitReport): string {
    if (report.kind === "exit") return `Android process exit: ${report.reason}`;
    // The throw site, so different crashes of the same class are different Rollbar items
    const frame = report.stack.split("\n")[1]?.trim() ?? "";
    return `Android uncaught ${report.exceptionClass} ${frame}`.trim();
}

/**
 * Sends what the Android shell recorded of its own crashes, ANRs and kills since the last start to
 * Rollbar, through the logger and its noise filter. The shell hands each report out once. A shell
 * older than the command has nothing to give: that fails quietly.
 */
export async function reportNativeExits(logger: ErrorLogger): Promise<void> {
    let reports: NativeExitReport[];
    try {
        const result = await invoke<{ reports?: NativeExitReport[] }>(
            "plugin:oc|take_native_exit_reports",
        );
        reports = result.reports ?? [];
    } catch (e) {
        console.debug("Native exit reports unavailable", e);
        return;
    }
    for (const report of reports) {
        logger.logError(title(report), report);
    }
}
