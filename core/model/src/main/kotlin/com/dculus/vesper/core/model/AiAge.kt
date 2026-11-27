package com.dculus.vesper.core.model

import java.time.YearMonth

/** The AI block builder is for adults only: Google's Gemini API terms exclude under-18s. */
const val AI_MIN_AGE_YEARS = 18L

/**
 * Whether someone born in [birth] is at least [AI_MIN_AGE_YEARS] in the month [now]. Only the month is asked, so the
 * birthday month itself does not count yet: the day is unknown.
 */
fun isOldEnoughForAi(
    birth: YearMonth,
    now: YearMonth,
): Boolean = birth.isBefore(now.minusYears(AI_MIN_AGE_YEARS))
