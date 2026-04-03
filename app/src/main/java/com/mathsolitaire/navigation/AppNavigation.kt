package com.mathsolitaire.navigation

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.mathsolitaire.ui.screens.GameScreen
import com.mathsolitaire.ui.screens.LevelSelectScreen
import com.mathsolitaire.ui.screens.MenuScreen
import com.mathsolitaire.viewmodel.GameViewModel

object Routes {
    const val MENU         = "menu"
    const val LEVEL_SELECT = "level_select"
    const val GAME         = "game/{levelNumber}"
    fun game(level: Int) = "game/$level"
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val viewModel: GameViewModel = viewModel()

    NavHost(navController = navController, startDestination = Routes.MENU) {

        composable(Routes.MENU) {
            MenuScreen(
                onPlayClick = {
                    val unlocked = viewModel.unlockedLevels.value
                    navController.navigate(Routes.game(unlocked.coerceAtLeast(1)))
                    viewModel.startLevel(unlocked.coerceAtLeast(1))
                },
                onLevelSelectClick = {
                    navController.navigate(Routes.LEVEL_SELECT)
                }
            )
        }

        composable(Routes.LEVEL_SELECT) {
            LevelSelectScreen(
                viewModel = viewModel,
                onLevelSelected = { levelNumber ->
                    viewModel.startLevel(levelNumber)
                    navController.navigate(Routes.game(levelNumber))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.GAME,
            arguments = listOf(navArgument("levelNumber") { type = NavType.IntType })
        ) { backStackEntry ->
            val levelNumber = backStackEntry.arguments?.getInt("levelNumber") ?: 1
            GameScreen(
                viewModel   = viewModel,
                onBack      = { navController.popBackStack() },
                onNextLevel = {
                    val next = levelNumber + 1
                    viewModel.startLevel(next)
                    navController.navigate(Routes.game(next)) {
                        popUpTo(Routes.game(levelNumber)) { inclusive = true }
                    }
                }
            )
        }
    }
}
