package com.dekoor.lifetracker.core.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.dekoor.lifetracker.R
import com.dekoor.lifetracker.feature.achievements.AchievementsScreen
import com.dekoor.lifetracker.feature.habits.HabitsScreen
import com.dekoor.lifetracker.feature.home.HomeScreen
import com.dekoor.lifetracker.feature.journal.JournalScreen
import com.dekoor.lifetracker.feature.notes.NotesScreen
import com.dekoor.lifetracker.feature.stats.StatsScreen

data class TopLevelDest(
    val route: String,
    val icon: ImageVector,
    val labelRes: Int
)

private val topLevel = listOf(
    TopLevelDest(Routes.HOME, Icons.Outlined.Home, R.string.tab_home),
    TopLevelDest(Routes.JOURNAL, Icons.Outlined.EditNote, R.string.tab_journal),
    TopLevelDest(Routes.HABITS, Icons.Outlined.CheckCircle, R.string.tab_habits),
    TopLevelDest(Routes.NOTES, Icons.Outlined.StickyNote2, R.string.tab_notes),
    TopLevelDest(Routes.STATS, Icons.Outlined.BarChart, R.string.tab_stats),
)

@Composable
fun MainNavScaffold(onSignOut: () -> Unit) {
    val nav: NavHostController = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val currentRoute = entry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                topLevel.forEach { dest ->
                    NavigationBarItem(
                        selected = currentRoute == dest.route,
                        onClick = {
                            if (currentRoute != dest.route) {
                                nav.navigate(dest.route) {
                                    popUpTo(Routes.HOME) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        },
                        icon = { Icon(dest.icon, contentDescription = null) },
                        label = { Text(androidx.compose.ui.res.stringResource(dest.labelRes)) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding)
        ) {
            composable(Routes.HOME) {
                HomeScreen(
                    onOpenJournal = { nav.navigate(Routes.JOURNAL) },
                    onOpenAchievements = { nav.navigate(Routes.ACHIEVEMENTS) },
                    onSignOut = onSignOut
                )
            }
            composable(Routes.JOURNAL) { JournalScreen() }
            composable(Routes.HABITS) { HabitsScreen() }
            composable(Routes.NOTES) { NotesScreen() }
            composable(Routes.STATS) { StatsScreen() }
            composable(Routes.ACHIEVEMENTS) { AchievementsScreen() }
        }
    }
}
