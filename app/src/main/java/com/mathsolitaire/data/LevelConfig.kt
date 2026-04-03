package com.mathsolitaire.data

data class LevelConfig(
    val levelNumber: Int,
    val target: Int,
    val pyramidRows: Int,
    val stockLimit: Int = Int.MAX_VALUE,  // max draws from stock; Int.MAX_VALUE = unlimited
    val timeLimitSeconds: Int = 0,        // 0 = no limit
    val description: String
)

object Levels {
    val all: List<LevelConfig> = listOf(
        // Levels 1-10: target 13, 5-row pyramid, unlimited stock
        LevelConfig(1,  13, 5, description = "Pirámide pequeña"),
        LevelConfig(2,  13, 5, description = "Pirámide pequeña"),
        LevelConfig(3,  13, 5, description = "Pirámide pequeña"),
        LevelConfig(4,  13, 5, description = "Pirámide pequeña"),
        LevelConfig(5,  13, 5, description = "Pirámide mediana"),
        LevelConfig(6,  13, 6, description = "Pirámide mediana"),
        LevelConfig(7,  13, 6, description = "Pirámide mediana"),
        LevelConfig(8,  13, 6, description = "Pirámide mediana"),
        LevelConfig(9,  13, 6, description = "Pirámide mediana"),
        LevelConfig(10, 13, 6, description = "Pirámide mediana"),

        // Levels 11-20: target 13, 7-row pyramid, limited stock draws
        LevelConfig(11, 13, 7, stockLimit = 5, description = "Pirámide completa"),
        LevelConfig(12, 13, 7, stockLimit = 5, description = "Pirámide completa"),
        LevelConfig(13, 13, 7, stockLimit = 5, description = "Pirámide completa"),
        LevelConfig(14, 13, 7, stockLimit = 4, description = "Pocas cartas extra"),
        LevelConfig(15, 13, 7, stockLimit = 4, description = "Pocas cartas extra"),
        LevelConfig(16, 13, 7, stockLimit = 4, description = "Pocas cartas extra"),
        LevelConfig(17, 13, 7, stockLimit = 3, description = "Stock limitado"),
        LevelConfig(18, 13, 7, stockLimit = 3, description = "Stock limitado"),
        LevelConfig(19, 13, 7, stockLimit = 3, description = "Stock limitado"),
        LevelConfig(20, 13, 7, stockLimit = 2, description = "Gran desafío"),

        // Levels 21-30: varying targets, time pressure
        LevelConfig(21, 10, 5, timeLimitSeconds = 120, description = "Objetivo 10 - Contrarreloj"),
        LevelConfig(22, 10, 5, timeLimitSeconds = 120, description = "Objetivo 10 - Contrarreloj"),
        LevelConfig(23, 12, 6, timeLimitSeconds = 150, description = "Objetivo 12 - Contrarreloj"),
        LevelConfig(24, 12, 6, timeLimitSeconds = 150, description = "Objetivo 12 - Contrarreloj"),
        LevelConfig(25, 15, 6, timeLimitSeconds = 150, description = "Objetivo 15 - Contrarreloj"),
        LevelConfig(26, 15, 7, stockLimit = 3, timeLimitSeconds = 180, description = "Experto"),
        LevelConfig(27, 10, 7, stockLimit = 3, timeLimitSeconds = 180, description = "Experto"),
        LevelConfig(28, 12, 7, stockLimit = 3, timeLimitSeconds = 180, description = "Experto"),
        LevelConfig(29, 13, 7, stockLimit = 2, timeLimitSeconds = 180, description = "Maestro"),
        LevelConfig(30, 13, 7, stockLimit = 1, timeLimitSeconds = 150, description = "¡Desafío supremo!")
    )
}
