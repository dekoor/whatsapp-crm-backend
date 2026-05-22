package com.dekoor.lifetracker.feature.achievements

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private data class Badge(val title: String, val description: String, val unlocked: Boolean)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AchievementsScreen() {
    val badges = listOf(
        Badge("Primer registro", "Hiciste tu primer registro diario.", true),
        Badge("Racha de 3 días", "3 registros consecutivos.", true),
        Badge("Semana completa", "7 días seguidos registrando tu verdad.", false),
        Badge("Mes constante", "30 días seguidos. ¡Increíble!", false),
        Badge("Hábitos en marcha", "Creaste tu primer hábito.", false),
        Badge("Reflexión profunda", "10 entradas con más de 100 caracteres.", false)
    )

    Scaffold(topBar = { TopAppBar(title = { Text("Logros") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(badges) { b ->
                Card(shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Icon(
                            Icons.Outlined.EmojiEvents,
                            contentDescription = null,
                            modifier = Modifier.size(36.dp),
                            tint = if (b.unlocked) MaterialTheme.colorScheme.primary
                                   else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Column {
                            Text(b.title, style = MaterialTheme.typography.titleLarge)
                            Text(
                                b.description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
