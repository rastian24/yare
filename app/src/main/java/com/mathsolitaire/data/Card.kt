package com.mathsolitaire.data

data class Card(
    val id: Int,
    val value: Int,        // 1–13
    val row: Int,          // pyramid row (0-indexed from top), -1 = stock/waste
    val col: Int,          // column within row
    val faceUp: Boolean = true,
    val removed: Boolean = false,
    val selected: Boolean = false
) {
    val displayValue: String get() = when (value) {
        1  -> "A"
        11 -> "J"
        12 -> "Q"
        13 -> "K"
        else -> value.toString()
    }
}
