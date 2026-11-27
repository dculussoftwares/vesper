package com.dculus.vesper.feature.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.dculus.vesper.core.ui.components.PillButton
import com.dculus.vesper.core.ui.components.PillButtonSize
import com.dculus.vesper.core.ui.components.PillButtonVariant
import com.dculus.vesper.core.ui.components.V5BottomSheet
import com.dculus.vesper.core.ui.components.V5TextField
import com.dculus.vesper.core.ui.theme.VesperTheme
import java.time.Month
import java.time.YearMonth

internal const val AI_AGE_MONTH_TAG = "account_ai_age_month"
internal const val AI_AGE_YEAR_TAG = "account_ai_age_year"
internal const val AI_AGE_CONTINUE_TAG = "account_ai_age_continue"

private const val MONTH_DIGITS = 2
private const val YEAR_DIGITS = 4
private const val EARLIEST_BIRTH_YEAR = 1900

/** The typed birth month and year, or null while they are incomplete, impossible or in the future. */
internal fun birthMonthOrNull(
    month: String,
    year: String,
    now: YearMonth,
): YearMonth? {
    val m = month.toIntOrNull()?.takeIf { it in 1..Month.entries.size }
    val y = year.toIntOrNull()?.takeIf { it in EARLIEST_BIRTH_YEAR..now.year }
    return if (m == null || y == null) null else YearMonth.of(y, m).takeUnless { it.isAfter(now) }
}

/**
 * A neutral age question (Play Families guidance): it asks for the date and never says which answer unlocks anything.
 */
@Composable
internal fun AiAgeSheet(
    visible: Boolean,
    onAnswer: (YearMonth) -> Unit,
    onDismiss: () -> Unit,
    now: YearMonth = YearMonth.now(),
) {
    V5BottomSheet(visible = visible, onDismiss = onDismiss) {
        var month by rememberSaveable { mutableStateOf("") }
        var year by rememberSaveable { mutableStateOf("") }
        val birth = birthMonthOrNull(month, year, now)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(R.string.account_ai_age_title),
                style = VesperTheme.type.heading,
                color = VesperTheme.colors.ink,
            )
            Text(
                stringResource(R.string.account_ai_age_body),
                style = VesperTheme.type.body,
                color = VesperTheme.colors.textSecondary,
            )
            V5TextField(
                value = month,
                onValueChange = { month = it.filter(Char::isDigit).take(MONTH_DIGITS) },
                placeholder = stringResource(R.string.account_ai_age_month),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.testTag(AI_AGE_MONTH_TAG),
            )
            V5TextField(
                value = year,
                onValueChange = { year = it.filter(Char::isDigit).take(YEAR_DIGITS) },
                placeholder = stringResource(R.string.account_ai_age_year),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.testTag(AI_AGE_YEAR_TAG),
            )
            PillButton(
                stringResource(R.string.account_ai_age_continue),
                { birth?.let(onAnswer) },
                Modifier.fillMaxWidth().testTag(AI_AGE_CONTINUE_TAG),
                enabled = birth != null,
            )
            PillButton(
                stringResource(R.string.account_delete_cancel),
                onDismiss,
                Modifier.fillMaxWidth(),
                PillButtonVariant.Text,
                PillButtonSize.Medium,
            )
        }
    }
}
