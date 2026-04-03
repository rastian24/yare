package com.mathsolitaire.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mathsolitaire.data.Card
import com.mathsolitaire.ui.theme.DisabledGray
import com.mathsolitaire.ui.theme.TextLight

@Composable
fun StockAndWaste(
    stockSize: Int,
    stockDrawsLeft: Int,
    wasteTop: Card?,
    hintCardIds: List<Int>,
    cardWidth: Dp = 52.dp,
    cardHeight: Dp = 72.dp,
    onStockClick: () -> Unit,
    onWasteClick: (() -> Unit)?
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Stock pile
        if (stockSize > 0 && stockDrawsLeft > 0) {
            val fakeStockCard = Card(id = -1, value = 0, row = -1, col = -1, faceUp = false)
            CardView(
                card = fakeStockCard,
                cardWidth = cardWidth,
                cardHeight = cardHeight,
                onClick = onStockClick
            )
        } else {
            EmptyCardSlot(cardWidth = cardWidth, cardHeight = cardHeight, label = "Vacío")
        }

        // Stock count
        Text(
            text = if (stockDrawsLeft == Int.MAX_VALUE) "×$stockSize"
                   else "×$stockSize\n(${stockDrawsLeft}↓)",
            color = TextLight,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        Spacer(modifier = Modifier.width(32.dp))

        // Waste pile
        if (wasteTop != null) {
            val isHint = wasteTop.id in hintCardIds
            CardView(
                card = wasteTop.copy(faceUp = true),
                isHint = isHint,
                cardWidth = cardWidth,
                cardHeight = cardHeight,
                onClick = onWasteClick
            )
        } else {
            EmptyCardSlot(cardWidth = cardWidth, cardHeight = cardHeight)
        }
    }
}
