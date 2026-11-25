package com.dculus.vesper.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.dculus.vesper.core.ui.R
import com.dculus.vesper.core.ui.art.Spinner
import com.dculus.vesper.core.ui.theme.VesperTheme

/** A centered ink spinner for a screen or section that is still loading. */
@Composable
fun LoadingSpinner(modifier: Modifier = Modifier) {
    val description = stringResource(R.string.sf_loading)
    Box(
        modifier.fillMaxWidth().padding(vertical = 48.dp).semantics { stateDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Spinner(color = VesperTheme.colors.ink)
    }
}
