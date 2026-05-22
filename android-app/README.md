# LifeTracker — App Android

App Android personal para registrar tu progreso en distintas áreas de la vida (Salud, Aprendizaje, Productividad, Hábitos), con diario formativo, hábitos, notas, estadísticas y logros.

> **Nota sobre este repo:** Este código vive temporalmente bajo `whatsapp-crm-backend/android-app/`. Es una app completamente separada del backend de WhatsApp CRM. Ver la sección **Migrar a repo propio** al final.

## Stack

- **Kotlin 2.0** + **Jetpack Compose** + **Material 3**
- **Hilt** (DI) + **KSP**
- **Room** (persistencia local, offline-first)
- **Firebase Auth + Firestore + Messaging** (login, sync entre dispositivos, push)
- **WorkManager** (recordatorios diarios locales)
- **Vico** (gráficas Compose-native)
- **Navigation Compose**

## Estructura

```
android-app/
├── app/
│   └── src/main/java/com/dekoor/lifetracker/
│       ├── core/           # tema, navegación, DI
│       ├── data/           # Room, repos, Firestore
│       ├── domain/         # modelos y contratos
│       └── feature/        # pantallas (auth, home, journal, habits, notes, stats, achievements, reminders)
├── build.gradle.kts
├── settings.gradle.kts
└── gradle/libs.versions.toml
```

Arquitectura: MVVM con `StateFlow`, capa `domain` con interfaces de repositorio, `data` con implementaciones (Room local + sync futuro a Firestore).

## Requisitos

- **Android Studio Ladybug** (2024.2.1) o más nuevo
- **JDK 17**
- **Android SDK 34** (compileSdk) — `minSdk 26`
- Una cuenta de Firebase (gratis)

## Setup

### 1. Clonar y abrir

```bash
git clone <este-repo>
cd whatsapp-crm-backend/android-app
# Abrir en Android Studio → "Open" → seleccionar la carpeta android-app
```

### 2. Configurar Firebase

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto.
2. Añade una app Android con el package name **`com.dekoor.lifetracker`**.
   - Si usas la variante debug también, añade una segunda app con `com.dekoor.lifetracker.debug`.
3. Descarga `google-services.json` y colócalo en `app/google-services.json` (este archivo está en `.gitignore`, no se commitea).
4. En Firebase Console, habilita:
   - **Authentication → Sign-in method → Email/Password**
   - **Firestore Database** (modo producción, región más cercana a ti)
   - **Cloud Messaging** (no requiere setup adicional)

### 3. Generar el wrapper de Gradle

Como este scaffold no incluye el binario `gradle-wrapper.jar` ni el script `gradlew` (Android Studio los regenera automáticamente al abrir), corre una vez en una terminal con Gradle instalado, o deja que Android Studio lo haga:

```bash
# Opción A: desde Android Studio, simplemente abre el proyecto y deja que sincronice.
# Opción B: con Gradle 8.9 instalado localmente:
cd android-app
gradle wrapper --gradle-version 8.9
```

### 4. Build y run

```bash
./gradlew assembleDebug              # APK debug
./gradlew installDebug               # instala en dispositivo/emulador
./gradlew lintDebug                  # checks estáticos
```

O usa el botón ▶ de Android Studio.

## Features incluidas

### Implementadas
- ✅ **Login / Signup** con Firebase Auth (email + password)
- ✅ **Home/Dashboard** con racha, frase motivacional del día, último registro
- ✅ **Diario "Mi verdad de hoy"** con 4 prompts formativos y mood tracker
- ✅ **Hábitos**: crear hábito por área, marcar como hecho hoy
- ✅ **Notas**: CRUD básico
- ✅ **Estadísticas**: métricas + gráfica de mood (14 días) con Vico
- ✅ **Logros**: badges (mockup estático por ahora)
- ✅ **Notificaciones push** vía Firebase Cloud Messaging
- ✅ **Worker de recordatorio diario** (WorkManager — falta scheduler)

### Pendientes (próximas iteraciones)
- [ ] Sync activa con Firestore (hoy todo está local con Room)
- [ ] Scheduler que programe el `DailyReminderWorker` a una hora elegible
- [ ] Edición y borrado en Hábitos / Notas
- [ ] Filtros por área en Stats con gráficas por categoría
- [ ] Logros dinámicos basados en datos reales
- [ ] Onboarding la primera vez
- [ ] Tests unitarios y de UI

## Migrar a repo propio

Cuando quieras mover esta app a un repo dedicado (ej. `dekoor/life-tracker-android`):

```bash
# Desde la raíz de whatsapp-crm-backend
git subtree split --prefix=android-app -b life-tracker-export
mkdir ../life-tracker-android && cd ../life-tracker-android
git init
git pull ../whatsapp-crm-backend life-tracker-export
git remote add origin git@github.com:dekoor/life-tracker-android.git
git push -u origin main
```

Alternativa más simple (sin preservar historia):

```bash
cp -r android-app ../life-tracker-android
cd ../life-tracker-android
git init
git add . && git commit -m "Initial commit: LifeTracker Android scaffold"
git remote add origin git@github.com:dekoor/life-tracker-android.git
git push -u origin main
```

## Modelo de datos

### Local (Room)
- `journal_entries`: una entrada por día con `grateful / wins / learned / improve / mood`
- `habits`: nombre + área + meta semanal
- `habit_logs`: log diario por hábito (PK compuesto: `habitId + day`)
- `notes`: título, cuerpo, área opcional, pinned

### Firestore (cuando se active sync)
Estructura propuesta:
```
users/{uid}/
  journal/{entryId}
  habits/{habitId}
    logs/{day}
  notes/{noteId}
```
Reglas mínimas:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

- **"Default FirebaseApp is not initialized"** → falta `google-services.json` en `app/`.
- **KSP / Hilt errors al compilar** → `./gradlew clean` y resync.
- **Vico no resuelve imports** → la versión usa la API 2.x; si Android Studio muestra rojo, sincroniza Gradle.
- **`gradle-wrapper.jar` no encontrado** → corre `gradle wrapper --gradle-version 8.9` una vez.

## Licencia

Propietario — uso personal.
