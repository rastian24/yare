package com.mathsolitaire.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary           = AccentGold,
    onPrimary         = TextDark,
    primaryContainer  = AccentGoldDark,
    secondary         = CardMid,
    onSecondary       = TextLight,
    background        = TableGreen,
    onBackground      = TextLight,
    surface           = TableGreenLight,
    onSurface         = TextLight,
    surfaceVariant    = SurfaceDark,
    onSurfaceVariant  = TextLight,
    error             = LoseRed,
    onError           = TextLight
)

@Composable
fun MathSolitaireTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography  = AppTypography,
        content     = content
    )
}
