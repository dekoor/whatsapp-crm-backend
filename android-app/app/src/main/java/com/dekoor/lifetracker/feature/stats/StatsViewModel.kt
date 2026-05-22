package com.dekoor.lifetracker.feature.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.repository.JournalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

data class StatsUiState(
    val entriesThisMonth: Int = 0,
    val longestStreak: Int = 0,
    val avgMood: Double = 0.0,
    val moodPoints: List<Int> = emptyList()
)

@HiltViewModel
class StatsViewModel @Inject constructor(
    journal: JournalRepository
) : ViewModel() {

    val state: StateFlow<StatsUiState> = journal.observeRecent(90).map { entries ->
        val now = LocalDate.now()
        val month = now.withDayOfMonth(1)
        val entriesThisMonth = entries.count { !it.date.isBefore(month) }
        val avg = if (entries.isEmpty()) 0.0 else entries.map { it.mood }.average()

        val last14 = (13 downTo 0).map { delta ->
            val d = now.minusDays(delta.toLong())
            entries.firstOrNull { it.date == d }?.mood ?: 0
        }

        val sortedDates = entries.map { it.date }.distinct().sortedDescending()
        var longest = 0; var current = 0; var prev: LocalDate? = null
        for (d in sortedDates) {
            current = if (prev == null || ChronoUnit.DAYS.between(d, prev) == 1L) current + 1 else 1
            longest = maxOf(longest, current)
            prev = d
        }

        StatsUiState(
            entriesThisMonth = entriesThisMonth,
            longestStreak = longest,
            avgMood = avg,
            moodPoints = last14
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), StatsUiState())
}
