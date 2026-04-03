package com.mathsolitaire.viewmodel

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mathsolitaire.data.Card
import com.mathsolitaire.data.GameState
import com.mathsolitaire.data.GameStatus
import com.mathsolitaire.data.LevelConfig
import com.mathsolitaire.data.Levels
import com.mathsolitaire.game.MathValidator
import com.mathsolitaire.game.Move
import com.mathsolitaire.game.PyramidEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("math_solitaire", Context.MODE_PRIVATE)

    private val _gameState = MutableStateFlow(GameState())
    val gameState: StateFlow<GameState> = _gameState.asStateFlow()

    private val _timeLeft = MutableStateFlow(0)
    val timeLeft: StateFlow<Int> = _timeLeft.asStateFlow()

    private val _unlockedLevels = MutableStateFlow(loadUnlockedLevels())
    val unlockedLevels: StateFlow<Int> = _unlockedLevels.asStateFlow()

    private var currentConfig: LevelConfig? = null
    private var timerJob: Job? = null

    fun startLevel(levelNumber: Int) {
        val config = Levels.all.find { it.levelNumber == levelNumber } ?: return
        currentConfig = config
        val state = PyramidEngine.buildGame(config)
        _gameState.value = state
        startTimer(config.timeLimitSeconds)
    }

    fun selectCard(card: Card) {
        val state = _gameState.value
        if (state.status != GameStatus.PLAYING) return

        val currentSelected = state.selected

        // If tapping already-selected card, deselect
        if (currentSelected.any { it.id == card.id }) {
            _gameState.value = PyramidEngine.toggleSelect(state, card)
            return
        }

        // Check if single card is valid for removal
        if (currentSelected.isEmpty()) {
            if (MathValidator.isSingleValid(card, state.target)) {
                val newState = PyramidEngine.toggleSelect(state, card)
                _gameState.value = PyramidEngine.removeCards(newState, listOf(card))
                checkWinAndSave()
                return
            }
        }

        // Try pairing with already-selected card
        if (currentSelected.size == 1) {
            val other = currentSelected[0]
            if (MathValidator.isPairValid(other, card, state.target)) {
                val stateWithBoth = PyramidEngine.toggleSelect(state, card)
                _gameState.value = PyramidEngine.removeCards(stateWithBoth, listOf(other, card))
                checkWinAndSave()
                return
            } else {
                // Replace selection
                val deselected = PyramidEngine.toggleSelect(state, other)
                val reselected = PyramidEngine.toggleSelect(deselected, card)
                _gameState.value = reselected
                return
            }
        }

        // Just select
        _gameState.value = PyramidEngine.toggleSelect(state, card)
    }

    fun drawFromStock() {
        val state = _gameState.value
        if (state.status != GameStatus.PLAYING) return
        _gameState.value = PyramidEngine.drawFromStock(state)
    }

    fun restartLevel() {
        val config = currentConfig ?: return
        startLevel(config.levelNumber)
    }

    fun requestHint() {
        val state = _gameState.value
        val hint = PyramidEngine.getHint(state)
        _gameState.value = state.copy(hintCards = hint)
    }

    fun getLevel(levelNumber: Int): LevelConfig? = Levels.all.find { it.levelNumber == levelNumber }

    fun isLevelUnlocked(levelNumber: Int): Boolean = levelNumber <= _unlockedLevels.value

    private fun checkWinAndSave() {
        val state = _gameState.value
        if (state.status == GameStatus.WON) {
            timerJob?.cancel()
            val level = state.levelNumber
            val unlocked = _unlockedLevels.value
            if (level >= unlocked && level < Levels.all.size) {
                val newUnlocked = level + 1
                prefs.edit().putInt("unlocked_levels", newUnlocked).apply()
                _unlockedLevels.value = newUnlocked
            }
        }
    }

    private fun startTimer(seconds: Int) {
        timerJob?.cancel()
        if (seconds <= 0) {
            _timeLeft.value = 0
            return
        }
        _timeLeft.value = seconds
        timerJob = viewModelScope.launch {
            while (_timeLeft.value > 0) {
                delay(1000L)
                _timeLeft.value -= 1
                if (_timeLeft.value <= 0) {
                    _gameState.value = _gameState.value.copy(status = GameStatus.LOST)
                    break
                }
            }
        }
    }

    private fun loadUnlockedLevels(): Int = prefs.getInt("unlocked_levels", 1)

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
