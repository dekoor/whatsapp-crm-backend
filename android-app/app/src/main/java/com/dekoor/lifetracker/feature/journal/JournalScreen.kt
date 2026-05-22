package com.dekoor.lifetracker.feature.journal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dekoor.lifetracker.R

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun JournalScreen(vm: JournalViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(stringResource(R.string.journal_title)) })
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Spacer(Modifier.height(4.dp))
            Text(
                s.date.toString(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary
            )

            Text("¿Cómo te sientes?", style = MaterialTheme.typography.titleLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val moods = listOf("😞", "😐", "🙂", "😄", "🤩")
                moods.forEachIndexed { idx, emoji ->
                    val selected = s.mood == idx + 1
                    FilterChip(
                        selected = selected,
                        onClick = { vm.onMood(idx + 1) },
                        label = { Text(emoji, style = MaterialTheme.typography.titleLarge) }
                    )
                }
            }

            Field(
                label = stringResource(R.string.journal_prompt_grateful),
                value = s.grateful, onChange = vm::onGrateful
            )
            Field(
                label = stringResource(R.string.journal_prompt_win),
                value = s.wins, onChange = vm::onWins
            )
            Field(
                label = stringResource(R.string.journal_prompt_learn),
                value = s.learned, onChange = vm::onLearned
            )
            Field(
                label = stringResource(R.string.journal_prompt_improve),
                value = s.improve, onChange = vm::onImprove
            )

            Button(
                onClick = vm::save,
                enabled = !s.saving,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    if (s.saved) "Guardado ✓"
                    else stringResource(R.string.journal_save)
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        minLines = 2,
        modifier = Modifier.fillMaxWidth()
    )
}
