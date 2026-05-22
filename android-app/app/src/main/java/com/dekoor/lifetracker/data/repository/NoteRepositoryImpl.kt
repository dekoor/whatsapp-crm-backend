package com.dekoor.lifetracker.data.repository

import com.dekoor.lifetracker.data.local.dao.NoteDao
import com.dekoor.lifetracker.data.local.entity.NoteEntity
import com.dekoor.lifetracker.domain.model.LifeArea
import com.dekoor.lifetracker.domain.model.Note
import com.dekoor.lifetracker.domain.repository.NoteRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepositoryImpl @Inject constructor(
    private val dao: NoteDao
) : NoteRepository {

    override fun observeAll(): Flow<List<Note>> =
        dao.observeAll().map { list -> list.map { it.toDomain() } }

    override suspend fun upsert(note: Note) {
        dao.upsert(
            NoteEntity(
                id = note.id,
                title = note.title,
                body = note.body,
                areaId = note.area?.id,
                pinned = note.pinned,
                updatedAt = note.updatedAt
            )
        )
    }

    override suspend fun delete(id: String) = dao.delete(id)

    private fun NoteEntity.toDomain(): Note = Note(
        id = id,
        title = title,
        body = body,
        area = areaId?.let { LifeArea.fromId(it) },
        pinned = pinned,
        updatedAt = updatedAt
    )
}
