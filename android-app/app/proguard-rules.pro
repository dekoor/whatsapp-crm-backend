# Keep model classes used by Firestore / Room reflection
-keep class com.dekoor.lifetracker.domain.model.** { *; }
-keep class com.dekoor.lifetracker.data.remote.dto.** { *; }
-keepclassmembers class * {
    @com.google.firebase.firestore.PropertyName <fields>;
    @com.google.firebase.firestore.PropertyName <methods>;
}
