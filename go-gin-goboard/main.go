package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Move struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color"`
}

func main() {
	r := gin.Default()
	r.POST("/api/move", func(c *gin.Context) {
		var move Move
		if err := c.ShouldBindJSON(&move); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料"})
			return
		}
		log.Printf("收到落子：(%d, %d) 顏色：%s\n", move.X, move.Y, move.Color)
		c.JSON(http.StatusOK, gin.H{"message": "已紀錄落子"})
	})

	// CORS 設定
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.Run(":8080")
}
