package com.dekoor.lifetracker.core.di

import android.content.Context
import androidx.room.Room
import com.dekoor.lifetracker.data.local.AppDatabase
import com.dekoor.lifetracker.data.local.dao.HabitDao
import com.dekoor.lifetracker.data.local.dao.JournalDao
import com.dekoor.lifetracker.data.local.dao.NoteDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AppDatabase =
        Room.databaseBuilder(ctx, AppDatabase::class.java, "lifetracker.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideJournalDao(db: AppDatabase): JournalDao = db.journalDao()
    @Provides fun provideHabitDao(db: AppDatabase): HabitDao = db.habitDao()
    @Provides fun provideNoteDao(db: AppDatabase): NoteDao = db.noteDao()
}
