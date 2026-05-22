package com.dekoor.lifetracker.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey val id: String,
    val name: String,
    val areaId: String,
    val targetPerWeek: Int,
    val createdAt: Long,
    val active: Boolean
)

@Entity(tableName = "habit_logs", primaryKeys = ["habitId", "day"])
data class HabitLogEntity(
    val habitId: String,
    val day: String,
    val done: Boolean,
    val note: String?
)
