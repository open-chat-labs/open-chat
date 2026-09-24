package com.ocplugin.app.calls

import com.ocplugin.app.OCPluginCompanion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Pins invariant 11 of native calls M2 (#9510) on the shell side: a parked answer is
// handed out once.
class PendingCallActionTest {
    @Test
    fun `invariant 11 the parked call action is cleared on read`() {
        OCPluginCompanion.pendingCallAction = "{\"kind\":\"accept\"}"
        assertEquals("{\"kind\":\"accept\"}", OCPluginCompanion.takePendingCallAction())
        assertNull(OCPluginCompanion.takePendingCallAction())
    }
}
