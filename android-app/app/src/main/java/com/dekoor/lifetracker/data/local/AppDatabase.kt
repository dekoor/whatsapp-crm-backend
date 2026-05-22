package com.dekoor.lifetracker.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.dekoor.lifetracker.data.local.dao.HabitDao
import com.dekoor.lifetracker.data.local.dao.JournalDao
import com.dekoor.lifetracker.data.local.dao.NoteDao
import com.dekoor.lifetracker.data.local.entity.HabitEntity
import com.dekoor.lifetracker.data.local.entity.HabitLogEntity
import com.dekoor.lifetracker.data.local.entity.JournalEntity
import com.dekoor.lifetracker.data.local.entity.NoteEntity

@Database(
    entities = [
        JournalEntity::class,
        HabitEntity::class,
        HabitLogEntity::class,
        NoteEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun journalDao(): JournalDao
    abstract fun habitDao(): HabitDao
    abstract fun noteDao(): NoteDao
}
