package com.dekoor.lifetracker.domain.model

data class Habit(
    val id: String,
    val name: String,
    val area: LifeArea,
    val targetPerWeek: Int,
    val createdAt: Long,
    val active: Boolean = true
)

data class HabitLog(
    val id: String,
    val habitId: String,
    val day: String,
    val done: Boolean,
    val note: String? = null
)
