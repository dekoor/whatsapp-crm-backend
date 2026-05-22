package com.dekoor.lifetracker.data.repository

import com.dekoor.lifetracker.data.local.dao.JournalDao
import com.dekoor.lifetracker.data.local.entity.JournalEntity
import com.dekoor.lifetracker.domain.model.JournalEntry
import com.dekoor.lifetracker.domain.repository.JournalRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class JournalRepositoryImpl @Inject constructor(
    private val dao: JournalDao
) : JournalRepository {

    override fun observeRecent(limit: Int): Flow<List<JournalEntry>> =
        dao.observeRecent(limit).map { list -> list.map { it.toDomain() } }

    override fun observeForDate(date: LocalDate): Flow<JournalEntry?> =
        dao.observeForDate(date.toString()).map { it?.toDomain() }

    override suspend fun upsert(entry: JournalEntry) {
        dao.upsert(entry.toEntity())
    }

    override suspend fun delete(id: String) = dao.delete(id)

    private fun JournalEntity.toDomain(): JournalEntry = JournalEntry(
        id = id,
        date = LocalDate.parse(date),
        grateful = grateful,
        wins = wins,
        learned = learned,
        improve = improve,
        mood = mood,
        createdAt = createdAt
    )

    private fun JournalEntry.toEntity(): JournalEntity = JournalEntity(
        id = id,
        date = date.toString(),
        grateful = grateful,
        wins = wins,
        learned = learned,
        improve = improve,
        mood = mood,
        createdAt = createdAt
    )
}
