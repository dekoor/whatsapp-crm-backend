package com.dekoor.lifetracker.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dekoor.lifetracker.R

private val motivationalPhrases = listOf(
    "Cada pequeño registro construye una gran historia.",
    "La constancia vence al talento cuando el talento no es constante.",
    "No tienes que ser perfecto, solo presente.",
    "Tu yo de mañana te agradecerá lo que hagas hoy.",
    "Medir es el primer paso para mejorar."
)

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenJournal: () -> Unit,
    onOpenAchievements: () -> Unit,
    onSignOut: () -> Unit,
    vm: HomeViewModel = hiltViewModel()
) {
    val s by vm.state.collectAsStateWithLifecycle()
    val phrase = motivationalPhrases[(System.currentTimeMillis() / 86_400_000L % motivationalPhrases.size).toInt()]

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.home_title)) },
                actions = {
                    IconButton(onClick = onOpenAchievements) {
                        Icon(Icons.Outlined.EmojiEvents, contentDescription = "Logros")
                    }
                    IconButton(onClick = onSignOut) {
                        Icon(Icons.Outlined.Logout, contentDescription = "Salir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(Modifier.height(4.dp))
            val name = s.user?.displayName ?: s.user?.email?.substringBefore("@") ?: ""
            Text(
                stringResource(R.string.home_greeting, name),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.SemiBold
            )

            StreakCard(streak = s.streakDays)

            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text(
                        "Frase del día",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        phrase,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            if (s.todayEntry == null) {
                ElevatedButton(
                    onClick = onOpenJournal,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Registrar mi verdad de hoy") }
            } else {
                OutlinedButton(
                    onClick = onOpenJournal,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Editar registro de hoy") }
            }

            Text(
                "Tus últimos registros",
                style = MaterialTheme.typography.titleLarge
            )
            if (s.recent.isEmpty()) {
                Text(
                    "Aún no hay registros. Empieza hoy.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                s.recent.take(5).forEach { entry ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                entry.date.toString(),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.height(4.dp))
                            if (entry.wins.isNotBlank()) Text("🏆 ${entry.wins}", style = MaterialTheme.typography.bodyMedium)
                            if (entry.learned.isNotBlank()) Text("📚 ${entry.learned}", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StreakCard(streak: Int) {
    Card(
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
    ) {
        Row(
            modifier = Modifier.padding(20.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Outlined.LocalFireDepartment,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onTertiaryContainer,
                modifier = Modifier.size(36.dp)
            )
            Column {
                Text(
                    "Racha actual",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
                Text(
                    "$streak día" + if (streak == 1) "" else "s",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
