package com.dekoor.lifetracker.feature.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.model.Note
import com.dekoor.lifetracker.domain.repository.NoteRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val repo: NoteRepository
) : ViewModel() {

    val notes: StateFlow<List<Note>> = repo.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun create(title: String, body: String) {
        viewModelScope.launch {
            repo.upsert(
                Note(
                    id = UUID.randomUUID().toString(),
                    title = title.trim(),
                    body = body.trim(),
                    area = null,
                    pinned = false,
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }
}
