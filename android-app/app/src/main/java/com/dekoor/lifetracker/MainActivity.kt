package com.dekoor.lifetracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import com.dekoor.lifetracker.core.navigation.MainNavScaffold
import com.dekoor.lifetracker.core.ui.theme.LifeTrackerTheme
import com.dekoor.lifetracker.feature.auth.AuthGate
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LifeTrackerTheme {
                Root()
            }
        }
    }
}

@Composable
private fun Root() {
    AuthGate { onSignOut ->
        MainNavScaffold(onSignOut = onSignOut)
    }
}
