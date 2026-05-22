package com.dekoor.lifetracker.domain.model

enum class LifeArea(val id: String, val labelRes: Int) {
    HEALTH("health", com.dekoor.lifetracker.R.string.area_health),
    LEARNING("learning", com.dekoor.lifetracker.R.string.area_learning),
    PRODUCTIVITY("productivity", com.dekoor.lifetracker.R.string.area_productivity),
    HABITS("habits", com.dekoor.lifetracker.R.string.area_habits);

    companion object {
        fun fromId(id: String): LifeArea = entries.firstOrNull { it.id == id } ?: HABITS
    }
}
