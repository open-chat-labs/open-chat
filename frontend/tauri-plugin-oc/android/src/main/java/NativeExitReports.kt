package com.ocplugin.app

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.io.File
import java.util.Collections
import java.util.IdentityHashMap

// Crashes, ANRs and kills on the native side leave no trace in Rollbar, which only sees the web
// layer. The shell keeps them here and the web layer takes them on its next start
// (take_native_exit_reports) and logs each to Rollbar.
//
// A report never carries an exception's message: it can quote whatever the app was handling (a
// message, a file name, a URL). Class names and frames say where it died.

private const val MAX_STACK_CHARS = 20_000

// One abnormal end of the process.
sealed class NativeExitReport {
    abstract val timestamp: Long

    // An exit Android recorded (API 30+). `stack` is the main thread's frames for an ANR.
    data class Exit(
        override val timestamp: Long,
        val reason: String,
        val importance: Int,
        val status: Int,
        val stack: String?,
    ) : NativeExitReport()

    // A Kotlin/Java exception nothing caught. `thread` is the name up to its first space: OkHttp
    // names its threads after the URL they're fetching.
    data class Uncaught(
        override val timestamp: Long,
        val exceptionClass: String,
        val thread: String,
        val stack: String,
    ) : NativeExitReport()
}

// An exit as ApplicationExitInfo recorded it. `description` is the system's free text, which for a
// crash can quote the exception's message, so it never goes into a report (exitReport).
internal data class ExitRecord(
    val timestamp: Long,
    val pid: Int,
    val reason: Int,
    val status: Int,
    val importance: Int = 0,
    val description: String? = null,
)

internal class ExitSelection(val toReport: List<ExitRecord>, val watermark: Long)

// The name an exit is reported under, or null for one that isn't a fault: the user swiping the app
// away, the app exiting itself (restart_app), a package update, a background kill. A SIGKILL is
// how some OEMs' task killers end an app, so only other signals count.
internal fun exitReasonName(reason: Int, status: Int): String? = when (reason) {
    ApplicationExitInfo.REASON_CRASH -> "crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash_native"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "low_memory"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive_resource_usage"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "initialization_failure"
    ApplicationExitInfo.REASON_SIGNALED -> if (status == 9) null else "signaled"
    else -> null
}

// The exits after the last one reported that are faults, oldest first, and the new watermark: the
// newest exit seen, reported or not, so none is looked at twice.
internal fun exitsToReport(exits: List<ExitRecord>, lastReported: Long): ExitSelection {
    val fresh = exits.filter { it.timestamp > lastReported }
    return ExitSelection(
        toReport = fresh.filter { exitReasonName(it.reason, it.status) != null }.sortedBy { it.timestamp },
        watermark = fresh.maxOfOrNull { it.timestamp } ?: lastReported,
    )
}

// The report for an exit exitsToReport chose: its reason, importance and status, and for an ANR
// the main thread's block of [anrTrace]. Null for an exit that isn't a fault.
internal fun exitReport(record: ExitRecord, anrTrace: String?): NativeExitReport.Exit? {
    val reason = exitReasonName(record.reason, record.status) ?: return null
    return NativeExitReport.Exit(
        timestamp = record.timestamp,
        reason = reason,
        importance = record.importance,
        status = record.status,
        stack = anrTrace?.let(::anrMainThread),
    )
}

internal fun uncaughtReport(threadName: String, throwable: Throwable, timestamp: Long) =
    NativeExitReport.Uncaught(
        timestamp = timestamp,
        exceptionClass = throwable.javaClass.name,
        thread = threadName.substringBefore(' '),
        stack = stackWithoutMessages(throwable).take(MAX_STACK_CHARS),
    )

// [throwable]'s stack trace laid out as printStackTrace would, but built from its structure, with
// no messages: class names, frames, "... n more", and the same for every cause and suppressed
// exception.
internal fun stackWithoutMessages(throwable: Throwable): String = buildString {
    appendThrowable(throwable, "", "", emptyArray(), Collections.newSetFromMap(IdentityHashMap()))
}

private fun StringBuilder.appendThrowable(
    throwable: Throwable,
    caption: String,
    indent: String,
    enclosing: Array<StackTraceElement>,
    seen: MutableSet<Throwable>,
) {
    if (!seen.add(throwable)) {
        append(indent).append(caption).append("[CIRCULAR REFERENCE: ")
            .append(throwable.javaClass.name).append("]\n")
        return
    }
    val trace = throwable.stackTrace
    var last = trace.size - 1
    var enclosingLast = enclosing.size - 1
    while (last >= 0 && enclosingLast >= 0 && trace[last] == enclosing[enclosingLast]) {
        last--
        enclosingLast--
    }
    append(indent).append(caption).append(throwable.javaClass.name).append('\n')
    for (i in 0..last) append(indent).append("\tat ").append(trace[i]).append('\n')
    val shared = trace.size - 1 - last
    if (shared > 0) append(indent).append("\t... ").append(shared).append(" more\n")
    for (suppressed in throwable.suppressed) {
        appendThrowable(suppressed, "Suppressed: ", indent + "\t", trace, seen)
    }
    throwable.cause?.let { appendThrowable(it, "Caused by: ", indent, trace, seen) }
}

// The main thread's block of an ANR trace: its header, state and frames, up to the blank line that
// ends it. Only this leaves the device; the rest of the trace lists every thread and the process's
// memory.
internal fun anrMainThread(trace: String): String? {
    val lines = trace.lines()
    val start = lines.indexOfFirst { it.startsWith("\"main\"") }
    if (start < 0) return null
    val length = lines.subList(start, lines.size).indexOfFirst { it.isBlank() }
    val end = if (length < 0) lines.size else start + length
    return lines.subList(start, end).joinToString("\n").take(MAX_STACK_CHARS)
}

object NativeExitReports {
    private const val TAG = "OC_NATIVE_EXITS"
    private const val CRASH_FILE = "native_crashes.jsonl"
    private const val PREFS = "oc_native_exits"
    private const val LAST_REPORTED_EXIT = "lastReportedExit"

    // A crash loop must not grow the file, or the batch one start sends, without limit.
    private const val MAX_CRASH_FILE_BYTES = 100_000L
    private const val MAX_CRASHES_TAKEN = 5
    private const val MAX_EXITS_READ = 10
    private const val MAX_ANR_TRACE_BYTES = 256_000

    @Volatile
    private var installed = false

    // Persists any uncaught exception for the next start, then hands it to the handler that was
    // there before (the system's, which records the crash and kills the process). Called from the
    // Application, so it covers the activity, the FCM service and Telecom alike.
    fun installCrashHandler(context: Context) {
        if (installed) return
        installed = true
        val appContext = context.applicationContext
        val shellVersion = shellVersion(appContext)
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val report = uncaughtReport(thread.name, throwable, System.currentTimeMillis())
                val file = File(appContext.filesDir, CRASH_FILE)
                if (!file.exists() || file.length() < MAX_CRASH_FILE_BYTES) {
                    file.appendText(toJson(report, shellVersion).toString() + "\n")
                }
            } catch (_: Throwable) {
                // Never let this mask the crash itself.
            }
            previous?.uncaughtException(thread, throwable)
        }
    }

    // Every report not yet taken, oldest first. Taking them marks them taken: a report the web
    // layer then fails to send is lost, not sent twice. Blocking IO, so off the main thread.
    @Synchronized
    fun take(context: Context): List<JSONObject> {
        val reports = takeExits(context) + takeCrashes(context)
        return reports.sortedBy { it.optLong("timestamp") }
    }

    private fun takeExits(context: Context): List<JSONObject> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val infos = am.getHistoricalProcessExitReasons(context.packageName, 0, MAX_EXITS_READ)
            val selection = exitsToReport(
                infos.map {
                    ExitRecord(it.timestamp, it.pid, it.reason, it.status, it.importance, it.description)
                },
                prefs.getLong(LAST_REPORTED_EXIT, 0L),
            )
            prefs.edit().putLong(LAST_REPORTED_EXIT, selection.watermark).apply()
            val shellVersion = shellVersion(context)
            selection.toReport.mapNotNull { record ->
                val trace = if (record.reason == ApplicationExitInfo.REASON_ANR) {
                    anrTrace(infos.first { it.timestamp == record.timestamp && it.pid == record.pid })
                } else {
                    null
                }
                exitReport(record, trace)?.let { toJson(it, shellVersion) }
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Reading exit reasons failed", e)
            emptyList()
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun anrTrace(info: ApplicationExitInfo): String? = try {
        info.traceInputStream?.use { stream ->
            String(stream.readNBytesCompat(MAX_ANR_TRACE_BYTES), Charsets.UTF_8)
        }
    } catch (_: Throwable) {
        null
    }

    private fun java.io.InputStream.readNBytesCompat(limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        while (out.size() < limit) {
            val n = read(chunk, 0, minOf(chunk.size, limit - out.size()))
            if (n < 0) break
            out.write(chunk, 0, n)
        }
        return out.toByteArray()
    }

    private fun takeCrashes(context: Context): List<JSONObject> {
        val file = File(context.filesDir, CRASH_FILE)
        if (!file.exists()) return emptyList()
        return try {
            file.readLines()
                .filter { it.isNotBlank() }
                .takeLast(MAX_CRASHES_TAKEN)
                .mapNotNull { line -> try { JSONObject(line) } catch (_: Throwable) { null } }
        } catch (e: Throwable) {
            Log.w(TAG, "Reading persisted crashes failed", e)
            emptyList()
        } finally {
            file.delete()
        }
    }

    private fun toJson(report: NativeExitReport, shellVersion: String?): JSONObject {
        val json = JSONObject().put("timestamp", report.timestamp).put("shellVersion", shellVersion)
        when (report) {
            is NativeExitReport.Exit -> json
                .put("kind", "exit")
                .put("reason", report.reason)
                .put("importance", report.importance)
                .put("status", report.status)
                .put("stack", report.stack)
            is NativeExitReport.Uncaught -> json
                .put("kind", "uncaught")
                .put("exceptionClass", report.exceptionClass)
                .put("thread", report.thread)
                .put("stack", report.stack)
        }
        return json
    }

    private fun shellVersion(context: Context): String? = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
    } catch (_: Throwable) {
        null
    }
}
