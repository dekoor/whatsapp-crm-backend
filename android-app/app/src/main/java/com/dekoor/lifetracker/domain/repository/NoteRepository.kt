package com.dekoor.lifetracker.domain.repository

import com.dekoor.lifetracker.domain.model.Note
import kotlinx.coroutines.flow.Flow

interface NoteRepository {
    fun observeAll(): Flow<List<Note>>
    suspend fun upsert(note: Note)
    suspend fun delete(id: String)
}
