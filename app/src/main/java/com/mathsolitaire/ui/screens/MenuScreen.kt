package com.mathsolitaire.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mathsolitaire.data.Card
import com.mathsolitaire.ui.components.CardView
import com.mathsolitaire.ui.theme.AccentGold
import com.mathsolitaire.ui.theme.SurfaceDark
import com.mathsolitaire.ui.theme.TableGreen
import com.mathsolitaire.ui.theme.TableGreenLight
import com.mathsolitaire.ui.theme.TextDark
import com.mathsolitaire.ui.theme.TextLight

@Composable
fun MenuScreen(
    onPlayClick: () -> Unit,
    onLevelSelectClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "bg")
    val floatOffset by infiniteTransition.animateFloat(
        initialValue = -10f,
        targetValue = 10f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "float"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(SurfaceDark, TableGreen, TableGreenLight)
                )
            )
    ) {
        // Decorative floating cards
        DecorativeCards(floatOffset)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Title
            Text(
                text = "MATH",
                color = AccentGold,
                fontSize = 56.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 4.sp
            )
            Text(
                text = "SOLITAIRE",
                color = TextLight,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 8.sp
            )
            Text(
                text = "Brain Puzzle",
                color = AccentGold.copy(alpha = 0.7f),
                fontSize = 16.sp,
                fontWeight = FontWeight.Normal,
                letterSpacing = 3.sp
            )

            Spacer(modifier = Modifier.height(60.dp))

            // Objective hint
            Box(
                modifier = Modifier
                    .background(SurfaceDark.copy(alpha = 0.7f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Combiná cartas con +, -, ×, ÷\npara llegar al número objetivo",
                    color = TextLight.copy(alpha = 0.8f),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )
            }

            Spacer(modifier = Modifier.height(48.dp))

            Button(
                onClick = onPlayClick,
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AccentGold,
                    contentColor = TextDark
                )
            ) {
                Text(
                    text = "JUGAR",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = onLevelSelectClick,
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(48.dp),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = TextLight
                )
            ) {
                Text(
                    text = "SELECCIONAR NIVEL",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

@Composable
private fun DecorativeCards(floatOffset: Float) {
    val sampleCards = listOf(
        Card(id = 100, value = 7,  row = -1, col = -1),
        Card(id = 101, value = 6,  row = -1, col = -1),
        Card(id = 102, value = 13, row = -1, col = -1),
        Card(id = 103, value = 1,  row = -1, col = -1),
    )

    Box(modifier = Modifier.fillMaxSize()) {
        WrappedCard(
            card = sampleCards[0],
            cardWidth = 44.dp,
            cardHeight = 62.dp,
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset(x = 20.dp, y = (80 + floatOffset).dp)
                .alpha(0.4f)
        )
        WrappedCard(
            card = sampleCards[1],
            cardWidth = 44.dp,
            cardHeight = 62.dp,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = (-20).dp, y = (100 - floatOffset).dp)
                .alpha(0.4f)
        )
        WrappedCard(
            card = sampleCards[2],
            cardWidth = 44.dp,
            cardHeight = 62.dp,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(x = 30.dp, y = (-120 + floatOffset).dp)
                .alpha(0.3f)
        )
        WrappedCard(
            card = sampleCards[3],
            cardWidth = 44.dp,
            cardHeight = 62.dp,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = (-30).dp, y = (-140 - floatOffset).dp)
                .alpha(0.3f)
        )
    }
}

// Wrapper to allow modifier on CardView
@Composable
private fun WrappedCard(
    card: Card,
    cardWidth: androidx.compose.ui.unit.Dp,
    cardHeight: androidx.compose.ui.unit.Dp,
    modifier: Modifier
) {
    Box(modifier = modifier) {
        CardView(card = card, cardWidth = cardWidth, cardHeight = cardHeight)
    }
}
