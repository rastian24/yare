package com.mathsolitaire.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mathsolitaire.data.LevelConfig
import com.mathsolitaire.data.Levels
import com.mathsolitaire.ui.theme.AccentGold
import com.mathsolitaire.ui.theme.DisabledGray
import com.mathsolitaire.ui.theme.SurfaceDark
import com.mathsolitaire.ui.theme.TableGreen
import com.mathsolitaire.ui.theme.TableGreenLight
import com.mathsolitaire.ui.theme.TextLight
import com.mathsolitaire.viewmodel.GameViewModel

@Composable
fun LevelSelectScreen(
    viewModel: GameViewModel,
    onLevelSelected: (Int) -> Unit,
    onBack: () -> Unit
) {
    val unlockedLevels by viewModel.unlockedLevels.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(SurfaceDark, TableGreen))
            )
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(SurfaceDark)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Volver", tint = TextLight)
            }
            Text(
                text = "Seleccionar Nivel",
                color = AccentGold,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(start = 8.dp)
            )
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(Levels.all) { level ->
                val unlocked = level.levelNumber <= unlockedLevels
                LevelCell(
                    level = level,
                    unlocked = unlocked,
                    onClick = {
                        if (unlocked) onLevelSelected(level.levelNumber)
                    }
                )
            }
        }
    }
}

@Composable
private fun LevelCell(
    level: LevelConfig,
    unlocked: Boolean,
    onClick: () -> Unit
) {
    val bgColor = when {
        !unlocked              -> SurfaceDark
        level.levelNumber > 20 -> AccentGold.copy(alpha = 0.25f)
        level.levelNumber > 10 -> TableGreenLight.copy(alpha = 0.5f)
        else                   -> TableGreen.copy(alpha = 0.8f)
    }

    Box(
        modifier = Modifier
            .size(72.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .border(
                width = 1.dp,
                color = if (unlocked) AccentGold.copy(alpha = 0.4f) else DisabledGray.copy(alpha = 0.3f),
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .alpha(if (unlocked) 1f else 0.5f),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (!unlocked) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = DisabledGray, modifier = Modifier.size(20.dp))
            } else {
                Text(
                    text = "${level.levelNumber}",
                    color = if (level.levelNumber > 20) AccentGold else TextLight,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            if (unlocked && level.timeLimitSeconds > 0) {
                Icon(
                    Icons.Default.Timer,
                    contentDescription = null,
                    tint = AccentGold,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}
