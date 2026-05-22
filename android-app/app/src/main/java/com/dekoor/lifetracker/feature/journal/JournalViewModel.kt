package com.dekoor.lifetracker.feature.journal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.model.JournalEntry
import com.dekoor.lifetracker.domain.repository.JournalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

data class JournalUiState(
    val date: LocalDate = LocalDate.now(),
    val grateful: String = "",
    val wins: String = "",
    val learned: String = "",
    val improve: String = "",
    val mood: Int = 3,
    val saving: Boolean = false,
    val saved: Boolean = false,
    val existingId: String? = null
)

@HiltViewModel
class JournalViewModel @Inject constructor(
    private val journal: JournalRepository
) : ViewModel() {

    private val _state = MutableStateFlow(JournalUiState())
    val state: StateFlow<JournalUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            journal.observeForDate(LocalDate.now()).collect { existing ->
                if (existing != null && _state.value.existingId == null) {
                    _state.value = _state.value.copy(
                        existingId = existing.id,
                        grateful = existing.grateful,
                        wins = existing.wins,
                        learned = existing.learned,
                        improve = existing.improve,
                        mood = existing.mood
                    )
                }
            }
        }
    }

    fun onGrateful(v: String) { _state.value = _state.value.copy(grateful = v, saved = false) }
    fun onWins(v: String) { _state.value = _state.value.copy(wins = v, saved = false) }
    fun onLearned(v: String) { _state.value = _state.value.copy(learned = v, saved = false) }
    fun onImprove(v: String) { _state.value = _state.value.copy(improve = v, saved = false) }
    fun onMood(v: Int) { _state.value = _state.value.copy(mood = v, saved = false) }

    fun save() {
        val s = _state.value
        _state.value = s.copy(saving = true)
        viewModelScope.launch {
            journal.upsert(
                JournalEntry(
                    id = s.existingId ?: UUID.randomUUID().toString(),
                    date = s.date,
                    grateful = s.grateful.trim(),
                    wins = s.wins.trim(),
                    learned = s.learned.trim(),
                    improve = s.improve.trim(),
                    mood = s.mood,
                    createdAt = System.currentTimeMillis()
                )
            )
            _state.value = _state.value.copy(saving = false, saved = true)
        }
    }
}
