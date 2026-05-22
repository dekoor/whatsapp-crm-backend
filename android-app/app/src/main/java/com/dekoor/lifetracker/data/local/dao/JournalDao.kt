package com.dekoor.lifetracker.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.dekoor.lifetracker.data.local.entity.JournalEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface JournalDao {
    @Query("SELECT * FROM journal_entries ORDER BY date DESC LIMIT :limit")
    fun observeRecent(limit: Int): Flow<List<JournalEntity>>

    @Query("SELECT * FROM journal_entries WHERE date = :date LIMIT 1")
    fun observeForDate(date: String): Flow<JournalEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: JournalEntity)

    @Query("DELETE FROM journal_entries WHERE id = :id")
    suspend fun delete(id: String)
}
