package com.dekoor.lifetracker.domain.model

import java.time.LocalDate

data class JournalEntry(
    val id: String,
    val date: LocalDate,
    val grateful: String,
    val wins: String,
    val learned: String,
    val improve: String,
    val mood: Int,
    val createdAt: Long
)
