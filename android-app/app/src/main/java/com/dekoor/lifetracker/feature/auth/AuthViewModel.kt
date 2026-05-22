package com.dekoor.lifetracker.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dekoor.lifetracker.domain.model.User
import com.dekoor.lifetracker.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val isSignUp: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: AuthRepository
) : ViewModel() {

    val currentUser: StateFlow<User?> =
        auth.currentUser.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun onEmail(v: String) { _state.value = _state.value.copy(email = v, error = null) }
    fun onPassword(v: String) { _state.value = _state.value.copy(password = v, error = null) }
    fun toggleMode() { _state.value = _state.value.copy(isSignUp = !_state.value.isSignUp, error = null) }

    fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.length < 6) {
            _state.value = s.copy(error = "Correo válido y contraseña ≥ 6 caracteres")
            return
        }
        _state.value = s.copy(loading = true, error = null)
        viewModelScope.launch {
            val result = if (s.isSignUp) auth.signUp(s.email, s.password)
                         else auth.signIn(s.email, s.password)
            result
                .onSuccess { _state.value = _state.value.copy(loading = false) }
                .onFailure { _state.value = _state.value.copy(loading = false, error = it.message ?: "Error") }
        }
    }

    fun signOut() {
        viewModelScope.launch { auth.signOut() }
    }
}
