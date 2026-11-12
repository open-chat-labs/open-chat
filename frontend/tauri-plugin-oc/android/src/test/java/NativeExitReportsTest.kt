package com.ocplugin.app

import android.app.ApplicationExitInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The native crash and exit reports the web layer sends to Rollbar (NativeExitReports.kt).
class NativeExitReportsTest {

    // Invariant 1: a report never carries an exception's message, of the exception, its causes or
    // what it suppressed. Nor a thread name past its first space (OkHttp's carry the URL).
    @Test
    fun `invariant 1 an uncaught report carries no exception message`() {
        val cause = IllegalArgumentException("secret cause")
        val thrown = IllegalStateException("secret message", cause)
        thrown.addSuppressed(RuntimeException("secret suppressed"))

        val report = uncaughtReport("OkHttp https://secret.example/blob", thrown, 1L)

        assertFalse(report.toString().contains("secret"))
        assertEquals("java.lang.IllegalStateException", report.exceptionClass)
        assertEquals("OkHttp", report.thread)
        assertTrue(report.stack.contains("Caused by: java.lang.IllegalArgumentException"))
        assertTrue(report.stack.contains("\tat com.ocplugin.app.NativeExitReportsTest"))
    }

    // Invariant 1 for an ANR: only the main thread's block leaves the device.
    @Test
    fun `invariant 1 an ANR report carries only the main thread`() {
        val trace = """
            ----- pid 123 at 2026-11-12 -----
            Cmd line: com.oclabs.openchat

            "main" prio=5 tid=1 Blocked
              at com.ocplugin.app.calls.CallRinger.ring(CallRinger.kt:42)

            "secret-thread" prio=5 tid=2 Runnable
              at com.example.Other.run(Other.kt:1)
        """.trimIndent()

        assertEquals(
            "\"main\" prio=5 tid=1 Blocked\n  at com.ocplugin.app.calls.CallRinger.ring(CallRinger.kt:42)",
            anrMainThread(trace),
        )
    }

    // Invariant 2: each exit is reported once. A second start sees the watermark the first left.
    @Test
    fun `invariant 2 each exit is reported once`() {
        val anr = ExitRecord(100, 1, ApplicationExitInfo.REASON_ANR, 0)
        val first = exitsToReport(listOf(anr), 0)
        assertEquals(listOf(anr), first.toReport)

        val crash = ExitRecord(200, 2, ApplicationExitInfo.REASON_CRASH, 0)
        val second = exitsToReport(listOf(crash, anr), first.watermark)
        assertEquals(listOf(crash), second.toReport)
        assertEquals(200L, second.watermark)
    }

    // Invariant 3: normal and user exits are not reported, but still move the watermark.
    @Test
    fun `invariant 3 normal and user exits are not reported`() {
        val exits = listOf(
            ExitRecord(100, 1, ApplicationExitInfo.REASON_USER_REQUESTED, 0),
            ExitRecord(200, 2, ApplicationExitInfo.REASON_EXIT_SELF, 0),
            ExitRecord(300, 3, ApplicationExitInfo.REASON_SIGNALED, 9),
        )
        val selection = exitsToReport(exits, 0)
        assertEquals(emptyList<ExitRecord>(), selection.toReport)
        assertEquals(300L, selection.watermark)
        assertNull(exitReasonName(ApplicationExitInfo.REASON_USER_REQUESTED, 0))
        assertEquals("crash_native", exitReasonName(ApplicationExitInfo.REASON_CRASH_NATIVE, 0))
    }
}
