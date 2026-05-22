package com.dekoor.lifetracker.domain.repository

import com.dekoor.lifetracker.domain.model.JournalEntry
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

interface JournalRepository {
    fun observeRecent(limit: Int = 30): Flow<List<JournalEntry>>
    fun observeForDate(date: LocalDate): Flow<JournalEntry?>
    suspend fun upsert(entry: JournalEntry)
    suspend fun delete(id: String)
}
