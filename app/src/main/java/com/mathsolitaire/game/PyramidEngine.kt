package com.mathsolitaire.game

import com.mathsolitaire.data.Card
import com.mathsolitaire.data.GameState
import com.mathsolitaire.data.GameStatus
import com.mathsolitaire.data.LevelConfig

object PyramidEngine {

    /**
     * Build initial game state from a level config.
     * Shuffles 52 cards and places [rows * (rows+1) / 2] in the pyramid,
     * rest go to the stock pile.
     */
    fun buildGame(config: LevelConfig): GameState {
        val rows = config.pyramidRows
        val pyramidSize = rows * (rows + 1) / 2

        // Create and shuffle full deck
        val deck = createDeck().shuffled()

        var cardId = 0
        val pyramid = mutableListOf<Card>()
        var deckIndex = 0

        for (row in 0 until rows) {
            for (col in 0..row) {
                val isTopRow = (row == rows - 1)
                pyramid.add(
                    Card(
                        id = cardId++,
                        value = deck[deckIndex++],
                        row = row,
                        col = col,
                        faceUp = isTopRow  // only bottom row starts face-up (accessible)
                    )
                )
            }
        }

        val stock = deck.drop(pyramidSize).mapIndexed { idx, value ->
            Card(id = cardId + idx, value = value, row = -1, col = -1, faceUp = false)
        }

        return GameState(
            pyramid = pyramid,
            stock = stock,
            waste = emptyList(),
            target = config.target,
            levelNumber = config.levelNumber,
            stockDrawsLeft = config.stockLimit
        )
    }

    /** Returns all accessible (playable) pyramid cards — those not covered. */
    fun accessibleCards(pyramid: List<Card>): List<Card> =
        pyramid.filter { card -> !card.removed && isAccessible(card, pyramid) }

    /**
     * A pyramid card is accessible when neither child (below-left, below-right) is still present.
     * In our layout, card at (row, col) is covered by:
     *   (row+1, col) and (row+1, col+1)
     */
    fun isAccessible(card: Card, pyramid: List<Card>): Boolean {
        if (card.removed) return false
        val childLeft  = pyramid.find { it.row == card.row + 1 && it.col == card.col     && !it.removed }
        val childRight = pyramid.find { it.row == card.row + 1 && it.col == card.col + 1 && !it.removed }
        return childLeft == null && childRight == null
    }

    /** Apply a card removal move and return the new state. */
    fun removeCards(state: GameState, cards: List<Card>): GameState {
        val ids = cards.map { it.id }.toSet()
        val newPyramid = state.pyramid.map { card ->
            if (card.id in ids) card.copy(removed = true, selected = false)
            else card.copy(selected = false)
        }
        // If waste top was removed, update waste too
        val wasteTop = state.wasteTop
        val newWaste = if (wasteTop != null && wasteTop.id in ids)
            state.waste.dropLast(1)
        else
            state.waste.map { if (it.id in ids) it.copy(removed = true) else it }

        val comboBonus = (state.combo + 1) * 10
        val baseScore = cards.size * 50
        val newScore = state.score + baseScore + comboBonus

        val newState = state.copy(
            pyramid = newPyramid,
            waste = newWaste,
            selected = emptyList(),
            score = newScore,
            moves = state.moves + 1,
            combo = state.combo + 1,
            hintCards = emptyList()
        )

        return checkGameOver(newState)
    }

    /** Draw one card from stock to waste. */
    fun drawFromStock(state: GameState): GameState {
        if (state.stock.isEmpty() || state.stockDrawsLeft <= 0) return state
        val drawn = state.stock.last().copy(faceUp = true, row = -1, col = -1)
        val newState = state.copy(
            stock = state.stock.dropLast(1),
            waste = state.waste + drawn,
            selected = emptyList(),
            moves = state.moves + 1,
            combo = 0,
            stockDrawsLeft = if (state.stockDrawsLeft == Int.MAX_VALUE) Int.MAX_VALUE
                             else state.stockDrawsLeft - 1,
            hintCards = emptyList()
        )
        return checkGameOver(newState)
    }

    /** Toggle selection on a card. Returns new state. */
    fun toggleSelect(state: GameState, card: Card): GameState {
        val alreadySelected = state.selected.any { it.id == card.id }
        return if (alreadySelected) {
            val newSelected = state.selected.filter { it.id != card.id }
            val newPyramid = state.pyramid.map {
                if (it.id == card.id) it.copy(selected = false) else it
            }
            val newWaste = state.waste.map {
                if (it.id == card.id) it.copy(selected = false) else it
            }
            state.copy(pyramid = newPyramid, waste = newWaste, selected = newSelected)
        } else {
            val newSelected = state.selected + card
            val newPyramid = state.pyramid.map {
                if (it.id == card.id) it.copy(selected = true) else it
            }
            val newWaste = state.waste.map {
                if (it.id == card.id) it.copy(selected = true) else it
            }
            state.copy(pyramid = newPyramid, waste = newWaste, selected = newSelected)
        }
    }

    /** Check if the game is won or lost. */
    fun checkGameOver(state: GameState): GameState {
        if (state.pyramid.all { it.removed }) {
            return state.copy(status = GameStatus.WON, hintCards = emptyList())
        }

        val accessible = accessibleCards(state.pyramid)
        val wasteTop = state.wasteTop
        val moves = MathValidator.findMoves(accessible, wasteTop, state.target)
        val canDraw = state.stock.isNotEmpty() && state.stockDrawsLeft > 0

        return if (moves.isEmpty() && !canDraw) {
            state.copy(status = GameStatus.LOST, hintCards = emptyList())
        } else {
            state
        }
    }

    /** Returns hint (card ids to highlight). Empty if no moves. */
    fun getHint(state: GameState): List<Int> {
        val accessible = accessibleCards(state.pyramid)
        val moves = MathValidator.findMoves(accessible, state.wasteTop, state.target)
        return when (val move = moves.firstOrNull()) {
            is Move.Single -> listOf(move.card.id)
            is Move.Pair   -> listOf(move.first.id, move.second.id)
            null           -> emptyList()
        }
    }

    private fun createDeck(): List<Int> {
        val deck = mutableListOf<Int>()
        repeat(4) { // 4 suits
            for (value in 1..13) {
                deck.add(value)
            }
        }
        return deck
    }
}
