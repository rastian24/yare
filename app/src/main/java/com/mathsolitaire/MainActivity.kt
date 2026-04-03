package com.mathsolitaire

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.mathsolitaire.navigation.AppNavigation
import com.mathsolitaire.ui.theme.MathSolitaireTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MathSolitaireTheme {
                AppNavigation()
            }
        }
    }
}
