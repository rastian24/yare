package com.mathsolitaire.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mathsolitaire.ui.theme.AccentGold
import com.mathsolitaire.ui.theme.SurfaceDark
import com.mathsolitaire.ui.theme.TableGreenLight
import com.mathsolitaire.ui.theme.TextLight

@Composable
fun GameHUD(
    levelNumber: Int,
    target: Int,
    score: Int,
    moves: Int,
    timeLeft: Int,
    hasTimeLimit: Boolean,
    pyramidRemaining: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp))
            .background(SurfaceDark)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        HUDItem(label = "Nivel", value = "$levelNumber")
        HUDItem(label = "Objetivo", value = "$target", highlight = true)
        HUDItem(label = "Cartas", value = "$pyramidRemaining")
        HUDItem(label = "Puntos", value = "$score")
        if (hasTimeLimit) {
            val mins = timeLeft / 60
            val secs = timeLeft % 60
            HUDItem(
                label = "Tiempo",
                value = "%d:%02d".format(mins, secs),
                highlight = timeLeft <= 30
            )
        } else {
            HUDItem(label = "Movs", value = "$moves")
        }
    }
}

@Composable
private fun HUDItem(label: String, value: String, highlight: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            color = TextLight.copy(alpha = 0.6f),
            fontSize = 10.sp
        )
        Text(
            text = value,
            color = if (highlight) AccentGold else TextLight,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
