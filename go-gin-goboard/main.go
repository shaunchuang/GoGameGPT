package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// =======================================
// 1. 定義資料庫模型 (Model)
// =======================================

// Game 代表一場對局 (可依需求增加欄位)
type Game struct {
	gorm.Model
	Name    string `gorm:"size:100"`  // 對局名稱
	SGFText string `gorm:"type:text"` // 用於儲存整個 SGF 內容 (TEXT 欄位)
}

// MoveRecord 代表每一步棋的記錄
type MoveRecord struct {
	gorm.Model
	GameID     uint   // 對應哪一局對局
	MoveNumber int    // 第幾手 (1, 2, 3, ...)
	X          int    // 棋子坐標 X
	Y          int    // 棋子坐標 Y
	Color      string // "black" or "white"
	Captures   int    // 此手提了多少顆對方棋子 (若有)
}

// =======================================
// 2. 接收前端落子資訊的結構
// =======================================
type MoveInput struct {
	GameID   uint   `json:"game_id"` // ← 新增這行
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Color    string `json:"color"`
	Captures int    `json:"captures"`
}

// =======================================
// 3. 全域變數 & 初始化資料庫
// =======================================
var DB *gorm.DB

func initDB() {
	dsn := "host=localhost user=postgres password=123456 dbname=mygodb port=5432 sslmode=disable TimeZone=Asia/Taipei"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("無法連線到資料庫:", err)
	}
	// 自動建立資料表
	if err := db.AutoMigrate(&Game{}, &MoveRecord{}); err != nil {
		log.Fatal("資料表自動遷移失敗:", err)
	}

	DB = db
	log.Println("資料庫連線成功並完成自動遷移！")
}

// =======================================
// 4. 主程式
// =======================================
func main() {
	// 先初始化資料庫
	initDB()

	r := gin.Default()

	// CORS 設定 (確保前端可跨域存取)
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// 範例：建立一局新的對局
	r.GET("/api/newgame", func(c *gin.Context) {
		game := Game{Name: "測試對局"}
		if err := DB.Create(&game).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "建立新對局失敗"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "成功建立新對局", "game_id": game.ID})
	})


	r.POST("/api/move", handleMove)       // 落子
	r.POST("/api/save-sgf", handleSaveSGF) // 儲存SGF
	r.GET("/api/game/:id/sgf", handleGetSGF) // 取得SGF
	r.GET("/api/game/:id/moves", handleGetMoves) // 取得棋譜

	r.Run(":8080")
}

// =======================================
// 5. 處理棋步 POST /api/move
// =======================================
func handleMove(c *gin.Context) {
	var input MoveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料"})
		return
	}

	// ✅ 新增這段：檢查 GameID 是否正確
	if input.GameID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少或無效的 game_id"})
		return
	}

	gameID := input.GameID

	// 取得當前對局的下一手編號
	var count int64
	DB.Model(&MoveRecord{}).Where("game_id = ?", gameID).Count(&count)
	moveNumber := int(count) + 1

	// 建立資料
	record := MoveRecord{
		GameID:     gameID,
		MoveNumber: moveNumber,
		X:          input.X,
		Y:          input.Y,
		Color:      input.Color,
		Captures:   input.Captures,
	}

	if err := DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法紀錄棋步"})
		return
	}

	log.Printf("收到落子：(%d, %d) 顏色：%s，提子：%d\n", input.X, input.Y, input.Color, input.Captures)

	c.JSON(http.StatusOK, gin.H{
		"message":     "已紀錄落子",
		"game_id":     gameID,
		"move_number": moveNumber,
	})
}


// 取得某局的 SGF 內容
func handleGetSGF(c *gin.Context) {
	gameID := c.Param("id")

	var game Game
	if err := DB.First(&game, gameID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到該對局"})
		return
	}

	if game.SGFText == "" {
		c.JSON(http.StatusOK, gin.H{"message": "尚未儲存SGF", "sgf": ""})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sgf": game.SGFText})
}

// 假設我們新增一個路由 POST /api/save-sgf 來儲存 SGF
type SaveSGFInput struct {
	GameID uint   `json:"game_id"`
	SGF    string `json:"sgf"`
}

func handleSaveSGF(c *gin.Context) {
	var input SaveSGFInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料"})
		return
	}

	// 嘗試找出該對局
	var game Game
	if err := DB.First(&game, input.GameID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到該對局"})
		return
	}

	// 更新 SGFText 欄位
	game.SGFText = input.SGF
	if err := DB.Save(&game).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法更新SGF內容"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SGF 儲存成功", "game_id": game.ID})
}

func handleGetMoves(c *gin.Context) {
	gameID := c.Param("id")
	var records []MoveRecord
	if err := DB.Where("game_id = ?", gameID).Order("move_number asc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得棋譜"})
		return
	}
	c.JSON(http.StatusOK, records)
}
