package com.dekoor.lifetracker.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey val id: String,
    val title: String,
    val body: String,
    val areaId: String?,
    val pinned: Boolean,
    val updatedAt: Long
)
