package com.mathsolitaire.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mathsolitaire.data.Card
import com.mathsolitaire.ui.theme.AccentGold
import com.mathsolitaire.ui.theme.CardBack
import com.mathsolitaire.ui.theme.CardBackLight
import com.mathsolitaire.ui.theme.CardFace
import com.mathsolitaire.ui.theme.CardHint
import com.mathsolitaire.ui.theme.CardHigh
import com.mathsolitaire.ui.theme.CardLow
import com.mathsolitaire.ui.theme.CardMid
import com.mathsolitaire.ui.theme.CardSelected
import com.mathsolitaire.ui.theme.DisabledGray
import com.mathsolitaire.ui.theme.TextDark
import com.mathsolitaire.ui.theme.TextLight

@Composable
fun CardView(
    card: Card,
    isHint: Boolean = false,
    cardWidth: Dp = 52.dp,
    cardHeight: Dp = 72.dp,
    onClick: (() -> Unit)? = null
) {
    val scale by animateFloatAsState(
        targetValue = if (card.selected) 1.08f else 1f,
        animationSpec = tween(150),
        label = "card_scale"
    )

    val shape = RoundedCornerShape(6.dp)

    Box(
        modifier = Modifier
            .size(width = cardWidth, height = cardHeight)
            .scale(scale)
            .shadow(if (card.selected) 8.dp else 3.dp, shape)
            .clip(shape)
            .background(
                when {
                    !card.faceUp        -> CardBack
                    card.selected       -> CardFace
                    else                -> CardFace
                }
            )
            .border(
                width = when {
                    card.selected -> 2.5.dp
                    isHint        -> 2.dp
                    else          -> 0.5.dp
                },
                color = when {
                    card.selected -> CardSelected
                    isHint        -> CardHint
                    else          -> Color.LightGray
                },
                shape = shape
            )
            .then(
                if (onClick != null && !card.removed)
                    Modifier.clickable { onClick() }
                else Modifier
            ),
        contentAlignment = Alignment.Center
    ) {
        if (!card.faceUp) {
            CardBackPattern()
        } else {
            val textColor = cardTextColor(card.value)
            Text(
                text = card.displayValue,
                color = textColor,
                fontSize = when {
                    cardWidth < 45.dp -> 14.sp
                    cardWidth < 56.dp -> 18.sp
                    else              -> 22.sp
                },
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun CardBackPattern() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CardBack)
            .padding(4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .border(1.dp, CardBackLight, RoundedCornerShape(3.dp))
        )
    }
}

private fun cardTextColor(value: Int): Color = when {
    value <= 4  -> CardLow
    value <= 9  -> CardMid
    else        -> CardHigh
}

@Composable
fun EmptyCardSlot(
    cardWidth: Dp = 52.dp,
    cardHeight: Dp = 72.dp,
    label: String = ""
) {
    Box(
        modifier = Modifier
            .size(width = cardWidth, height = cardHeight)
            .clip(RoundedCornerShape(6.dp))
            .border(1.dp, DisabledGray, RoundedCornerShape(6.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (label.isNotEmpty()) {
            Text(label, color = DisabledGray, fontSize = 10.sp, textAlign = TextAlign.Center)
        }
    }
}
