package com.dekoor.lifetracker.core.di

import com.dekoor.lifetracker.data.repository.AuthRepositoryImpl
import com.dekoor.lifetracker.data.repository.HabitRepositoryImpl
import com.dekoor.lifetracker.data.repository.JournalRepositoryImpl
import com.dekoor.lifetracker.data.repository.NoteRepositoryImpl
import com.dekoor.lifetracker.domain.repository.AuthRepository
import com.dekoor.lifetracker.domain.repository.HabitRepository
import com.dekoor.lifetracker.domain.repository.JournalRepository
import com.dekoor.lifetracker.domain.repository.NoteRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun bindAuth(impl: AuthRepositoryImpl): AuthRepository
    @Binds @Singleton abstract fun bindJournal(impl: JournalRepositoryImpl): JournalRepository
    @Binds @Singleton abstract fun bindHabit(impl: HabitRepositoryImpl): HabitRepository
    @Binds @Singleton abstract fun bindNote(impl: NoteRepositoryImpl): NoteRepository
}
