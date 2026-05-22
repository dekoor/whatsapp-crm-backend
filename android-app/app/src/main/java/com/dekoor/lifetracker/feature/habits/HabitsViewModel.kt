package com.dekoor.lifetracker.feature.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.model.Habit
import com.dekoor.lifetracker.domain.model.LifeArea
import com.dekoor.lifetracker.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

data class HabitsUiState(
    val habits: List<Habit> = emptyList(),
    val todayDoneIds: Set<String> = emptySet()
)

@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val repo: HabitRepository
) : ViewModel() {

    private val today get() = LocalDate.now().toString()

    val state: StateFlow<HabitsUiState> = combine(
        repo.observeHabits(),
        repo.observeLogsForDay(today)
    ) { habits, logs ->
        HabitsUiState(
            habits = habits,
            todayDoneIds = logs.filter { it.done }.map { it.habitId }.toSet()
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HabitsUiState())

    fun create(name: String, area: LifeArea) {
        viewModelScope.launch {
            repo.upsertHabit(
                Habit(
                    id = UUID.randomUUID().toString(),
                    name = name.trim(),
                    area = area,
                    targetPerWeek = 7,
                    createdAt = System.currentTimeMillis()
                )
            )
        }
    }

    fun toggleToday(habitId: String, done: Boolean) {
        viewModelScope.launch { repo.toggleLog(habitId, today, done) }
    }
}
