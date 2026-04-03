package com.mathsolitaire.game

import com.mathsolitaire.data.Card

object MathValidator {

    /** True if a single card can be removed (its value equals target). */
    fun isSingleValid(card: Card, target: Int): Boolean =
        card.value == target

    /**
     * True if two cards can be removed together using any of +, -, ×, ÷
     * such that the result equals target.
     */
    fun isPairValid(a: Card, b: Card, target: Int): Boolean {
        val x = a.value
        val y = b.value
        if (x + y == target) return true
        if (x - y == target) return true
        if (y - x == target) return true
        if (x * y == target) return true
        if (y != 0 && x % y == 0 && x / y == target) return true
        if (x != 0 && y % x == 0 && y / x == target) return true
        return false
    }

    /**
     * Returns a description of how a+b = target (for UI hints).
     * Returns null if not valid.
     */
    fun describePair(a: Card, b: Card, target: Int): String? {
        val x = a.value
        val y = b.value
        return when {
            x + y == target                         -> "${a.displayValue} + ${b.displayValue} = $target"
            x - y == target                         -> "${a.displayValue} - ${b.displayValue} = $target"
            y - x == target                         -> "${b.displayValue} - ${a.displayValue} = $target"
            x * y == target                         -> "${a.displayValue} × ${b.displayValue} = $target"
            y != 0 && x % y == 0 && x / y == target -> "${a.displayValue} ÷ ${b.displayValue} = $target"
            x != 0 && y % x == 0 && y / x == target -> "${b.displayValue} ÷ ${a.displayValue} = $target"
            else                                    -> null
        }
    }

    /**
     * Find all valid moves given a list of accessible cards and optional waste top card.
     * Returns list of Move objects.
     */
    fun findMoves(accessible: List<Card>, wasteTop: Card?, target: Int): List<Move> {
        val moves = mutableListOf<Move>()
        val candidates = if (wasteTop != null) accessible + wasteTop else accessible

        // Single card moves
        for (card in candidates) {
            if (isSingleValid(card, target)) {
                moves.add(Move.Single(card))
            }
        }

        // Pair moves
        for (i in candidates.indices) {
            for (j in i + 1 until candidates.size) {
                val a = candidates[i]
                val b = candidates[j]
                if (isPairValid(a, b, target)) {
                    moves.add(Move.Pair(a, b))
                }
            }
        }

        return moves
    }
}

sealed class Move {
    data class Single(val card: Card) : Move()
    data class Pair(val first: Card, val second: Card) : Move()
}
