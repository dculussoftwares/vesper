package com.dculus.vesper.kids

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import com.dculus.vesper.core.blocking.R as BlockingR

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class KidsBlockWordingTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test
    fun `a locked app is described as the parent's doing`() {
        assertEquals("Your parent locked this app.", context.getString(BlockingR.string.block_reason_manual_lock))
    }

    @Test
    fun `a use-then-lock rule is the parent's rule`() {
        assertEquals(
            "Your parent's rule: 10 min open, then 30 min locked. You used your 10 minutes.",
            context.getString(BlockingR.string.block_cycle_rule, 10, 30, 10),
        )
    }
}
