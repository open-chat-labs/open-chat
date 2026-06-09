package com.ocplugin.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.execSQL

@Database(
    entities = [Notification::class],
    version = 2,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDb: RoomDatabase() {
    abstract fun notificationDao(): NotificationDao

    companion object {
        @Volatile private var INSTANCE: AppDb? = null

        // v2: add the nullable `messageType` and `fileName` columns to `notifications`,
        // backing inline image vs. typed "shared a …" notification rendering.
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(connection: SQLiteConnection) {
                connection.execSQL("ALTER TABLE notifications ADD COLUMN messageType TEXT")
                connection.execSQL("ALTER TABLE notifications ADD COLUMN fileName TEXT")
                // Backfill messageType for pre-v2 rows to preserve thumbnail rendering.
                connection.execSQL("UPDATE notifications SET messageType = 'Image' WHERE image IS NOT NULL AND TRIM(image) <> ''")
            }
        }

        fun init(context: Context) {
            if (INSTANCE == null) {
                synchronized(this) {
                    if (INSTANCE == null) {
                        INSTANCE = Room.databaseBuilder(
                            context.applicationContext,
                            AppDb::class.java,
                            "app.db"
                        )
                            .addMigrations(MIGRATION_1_2)
                            .build()
                    }
                }
            }
        }

        fun get(): AppDb {
            return INSTANCE ?: throw IllegalStateException("AppDb not initialized!")
        }
    }
}