package com.dekoor.lifetracker.domain.model

data class Note(
    val id: String,
    val title: String,
    val body: String,
    val area: LifeArea?,
    val pinned: Boolean = false,
    val updatedAt: Long
)
