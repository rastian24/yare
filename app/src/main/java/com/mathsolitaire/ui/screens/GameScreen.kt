package com.mathsolitaire.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LightbulbCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.mathsolitaire.data.GameStatus
import com.mathsolitaire.ui.components.GameHUD
import com.mathsolitaire.ui.components.PyramidBoard
import com.mathsolitaire.ui.components.StockAndWaste
import com.mathsolitaire.ui.theme.AccentGold
import com.mathsolitaire.ui.theme.LoseRed
import com.mathsolitaire.ui.theme.SurfaceDark
import com.mathsolitaire.ui.theme.TableGreen
import com.mathsolitaire.ui.theme.TableGreenLight
import com.mathsolitaire.ui.theme.TextDark
import com.mathsolitaire.ui.theme.TextLight
import com.mathsolitaire.ui.theme.WinGreen
import com.mathsolitaire.viewmodel.GameViewModel

@Composable
fun GameScreen(
    viewModel: GameViewModel,
    onBack: () -> Unit,
    onNextLevel: () -> Unit
) {
    val state by viewModel.gameState.collectAsState()
    val timeLeft by viewModel.timeLeft.collectAsState()
    val config = viewModel.getLevel(state.levelNumber)
    val hasTimeLimit = (config?.timeLimitSeconds ?: 0) > 0

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(SurfaceDark, TableGreen, TableGreenLight))
            )
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // HUD
            GameHUD(
                levelNumber     = state.levelNumber,
                target          = state.target,
                score           = state.score,
                moves           = state.moves,
                timeLeft        = timeLeft,
                hasTimeLimit    = hasTimeLimit,
                pyramidRemaining = state.pyramidRemaining
            )

            // Top action bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Volver", tint = TextLight)
                }
                Row {
                    IconButton(onClick = { viewModel.restartLevel() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reiniciar", tint = TextLight)
                    }
                    IconButton(onClick = { viewModel.requestHint() }) {
                        Icon(Icons.Default.LightbulbCircle, contentDescription = "Pista", tint = AccentGold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Pyramid
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                PyramidBoard(
                    pyramid     = state.pyramid,
                    hintCardIds = state.hintCards,
                    onCardClick = { card -> viewModel.selectCard(card) }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Stock & Waste
            StockAndWaste(
                stockSize       = state.stockSize,
                stockDrawsLeft  = state.stockDrawsLeft,
                wasteTop        = state.wasteTop,
                hintCardIds     = state.hintCards,
                onStockClick    = { viewModel.drawFromStock() },
                onWasteClick    = state.wasteTop?.let { waste ->
                    { viewModel.selectCard(waste) }
                }
            )

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Win / Lose overlay
        AnimatedVisibility(
            visible = state.status != GameStatus.PLAYING,
            enter = fadeIn() + scaleIn(),
            exit  = fadeOut() + scaleOut()
        ) {
            GameOverDialog(
                won          = state.status == GameStatus.WON,
                score        = state.score,
                isLastLevel  = state.levelNumber >= 30,
                onRestart    = { viewModel.restartLevel() },
                onNextLevel  = onNextLevel,
                onMenu       = onBack
            )
        }
    }
}

@Composable
private fun GameOverDialog(
    won: Boolean,
    score: Int,
    isLastLevel: Boolean,
    onRestart: () -> Unit,
    onNextLevel: () -> Unit,
    onMenu: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.6f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(32.dp)
                .background(SurfaceDark, RoundedCornerShape(20.dp))
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = if (won) "¡GANASTE!" else "SIN MOVIMIENTOS",
                color = if (won) WinGreen else LoseRed,
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center
            )

            if (won) {
                Text(
                    text = "Puntos: $score",
                    color = AccentGold,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Text(
                    text = "No quedan movimientos válidos",
                    color = TextLight.copy(alpha = 0.7f),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (won && !isLastLevel) {
                Button(
                    onClick = onNextLevel,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentGold,
                        contentColor = TextDark
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("SIGUIENTE NIVEL", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            OutlinedButton(
                onClick = onRestart,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextLight)
            ) {
                Text("REINTENTAR", fontSize = 14.sp)
            }

            OutlinedButton(
                onClick = onMenu,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextLight.copy(alpha = 0.6f))
            ) {
                Text("MENÚ", fontSize = 14.sp)
            }
        }
    }
}
