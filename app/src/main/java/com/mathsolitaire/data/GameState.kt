package com.mathsolitaire.data

data class GameState(
    val pyramid: List<Card> = emptyList(),
    val stock: List<Card> = emptyList(),
    val waste: List<Card> = emptyList(),
    val selected: List<Card> = emptyList(),
    val target: Int = 13,
    val score: Int = 0,
    val moves: Int = 0,
    val combo: Int = 0,
    val status: GameStatus = GameStatus.PLAYING,
    val levelNumber: Int = 1,
    val stockDrawsLeft: Int = Int.MAX_VALUE,
    val hintCards: List<Int> = emptyList()   // ids of cards in hint move
) {
    val wasteTop: Card? get() = waste.lastOrNull()
    val stockSize: Int get() = stock.size
    val pyramidRemaining: Int get() = pyramid.count { !it.removed }
}

enum class GameStatus {
    PLAYING, WON, LOST
}
