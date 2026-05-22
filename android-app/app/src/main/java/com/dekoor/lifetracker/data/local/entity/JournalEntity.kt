package com.dekoor.lifetracker.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "journal_entries")
data class JournalEntity(
    @PrimaryKey val id: String,
    val date: String,
    val grateful: String,
    val wins: String,
    val learned: String,
    val improve: String,
    val mood: Int,
    val createdAt: Long
)
