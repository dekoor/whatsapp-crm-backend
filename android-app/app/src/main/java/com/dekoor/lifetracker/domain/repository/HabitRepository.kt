package com.dekoor.lifetracker.domain.repository

import com.dekoor.lifetracker.domain.model.Habit
import com.dekoor.lifetracker.domain.model.HabitLog
import kotlinx.coroutines.flow.Flow

interface HabitRepository {
    fun observeHabits(): Flow<List<Habit>>
    fun observeLogsForDay(day: String): Flow<List<HabitLog>>
    suspend fun upsertHabit(habit: Habit)
    suspend fun deleteHabit(id: String)
    suspend fun toggleLog(habitId: String, day: String, done: Boolean)
}
