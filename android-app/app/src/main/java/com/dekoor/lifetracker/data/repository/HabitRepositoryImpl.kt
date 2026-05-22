package com.dekoor.lifetracker.data.repository

import com.dekoor.lifetracker.data.local.dao.HabitDao
import com.dekoor.lifetracker.data.local.entity.HabitEntity
import com.dekoor.lifetracker.data.local.entity.HabitLogEntity
import com.dekoor.lifetracker.domain.model.Habit
import com.dekoor.lifetracker.domain.model.HabitLog
import com.dekoor.lifetracker.domain.model.LifeArea
import com.dekoor.lifetracker.domain.repository.HabitRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HabitRepositoryImpl @Inject constructor(
    private val dao: HabitDao
) : HabitRepository {

    override fun observeHabits(): Flow<List<Habit>> =
        dao.observeHabits().map { list -> list.map { it.toDomain() } }

    override fun observeLogsForDay(day: String): Flow<List<HabitLog>> =
        dao.observeLogsForDay(day).map { list ->
            list.map { HabitLog(it.habitId + ":" + it.day, it.habitId, it.day, it.done, it.note) }
        }

    override suspend fun upsertHabit(habit: Habit) {
        dao.upsert(
            HabitEntity(
                id = habit.id,
                name = habit.name,
                areaId = habit.area.id,
                targetPerWeek = habit.targetPerWeek,
                createdAt = habit.createdAt,
                active = habit.active
            )
        )
    }

    override suspend fun deleteHabit(id: String) = dao.delete(id)

    override suspend fun toggleLog(habitId: String, day: String, done: Boolean) {
        dao.upsertLog(HabitLogEntity(habitId = habitId, day = day, done = done, note = null))
    }

    private fun HabitEntity.toDomain(): Habit = Habit(
        id = id,
        name = name,
        area = LifeArea.fromId(areaId),
        targetPerWeek = targetPerWeek,
        createdAt = createdAt,
        active = active
    )
}
