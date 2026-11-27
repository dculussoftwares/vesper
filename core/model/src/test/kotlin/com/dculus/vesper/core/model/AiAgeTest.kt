package com.dculus.vesper.core.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.YearMonth

class AiAgeTest {
    private val now = YearMonth.of(2026, 11)

    @Test
    fun `born more than 18 years ago is old enough`() {
        assertTrue(isOldEnoughForAi(YearMonth.of(2008, 10), now))
        assertTrue(isOldEnoughForAi(YearMonth.of(1980, 1), now))
    }

    @Test
    fun `the 18th birthday month does not count yet`() {
        assertFalse(isOldEnoughForAi(YearMonth.of(2008, 11), now))
    }

    @Test
    fun `younger than 18 is not old enough`() {
        assertFalse(isOldEnoughForAi(YearMonth.of(2008, 12), now))
        assertFalse(isOldEnoughForAi(YearMonth.of(2018, 3), now))
    }
}
