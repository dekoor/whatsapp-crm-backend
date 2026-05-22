package com.dekoor.lifetracker.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.model.JournalEntry
import com.dekoor.lifetracker.domain.model.User
import com.dekoor.lifetracker.domain.repository.AuthRepository
import com.dekoor.lifetracker.domain.repository.JournalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate
import javax.inject.Inject

data class HomeUiState(
    val user: User? = null,
    val todayEntry: JournalEntry? = null,
    val streakDays: Int = 0,
    val recent: List<JournalEntry> = emptyList()
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    auth: AuthRepository,
    journal: JournalRepository
) : ViewModel() {

    val state: StateFlow<HomeUiState> = combine(
        auth.currentUser,
        journal.observeForDate(LocalDate.now()),
        journal.observeRecent(30)
    ) { user, today, recent ->
        HomeUiState(
            user = user,
            todayEntry = today,
            streakDays = computeStreak(recent),
            recent = recent
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState())

    private fun computeStreak(entries: List<JournalEntry>): Int {
        if (entries.isEmpty()) return 0
        val days = entries.map { it.date }.toSortedSet(compareByDescending { it })
        var streak = 0
        var cursor = LocalDate.now()
        for (d in days) {
            when {
                d == cursor -> { streak++; cursor = cursor.minusDays(1) }
                d == cursor.minusDays(1) -> {
                    cursor = d.minusDays(1); streak++
                }
                else -> return streak
            }
        }
        return streak
    }
}
