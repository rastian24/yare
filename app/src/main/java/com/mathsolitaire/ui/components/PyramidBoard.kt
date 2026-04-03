package com.mathsolitaire.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.mathsolitaire.data.Card
import com.mathsolitaire.game.PyramidEngine

@Composable
fun PyramidBoard(
    pyramid: List<Card>,
    hintCardIds: List<Int>,
    cardWidth: Dp = 52.dp,
    cardHeight: Dp = 72.dp,
    onCardClick: (Card) -> Unit
) {
    if (pyramid.isEmpty()) return

    val maxRow = pyramid.maxOf { it.row }
    val rows = (0..maxRow).map { row -> pyramid.filter { it.row == row }.sortedBy { it.col } }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy((-cardHeight * 0.35f)),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
    ) {
        rows.forEachIndexed { rowIndex, rowCards ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                rowCards.forEach { card ->
                    if (card.removed) {
                        Box(modifier = Modifier.size(cardWidth, cardHeight))
                    } else {
                        val accessible = PyramidEngine.isAccessible(card, pyramid)
                        val isHint = card.id in hintCardIds
                        CardView(
                            card = card.copy(faceUp = accessible),
                            isHint = isHint,
                            cardWidth = cardWidth,
                            cardHeight = cardHeight,
                            onClick = if (accessible) {{ onCardClick(card) }} else null
                        )
                    }
                }
            }
        }
    }
}
