import { useState, useEffect, useRef } from 'react'
import './App.css'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'

const BOARD_SIZE = 19
type Stone = 'black' | 'white' | null

function App() {
  // ---------------------- 計時相關 ----------------------
  const [blackTime, setBlackTime] = useState(0) // 累計黑方思考時間
  const [whiteTime, setWhiteTime] = useState(0) // 累計白方思考時間
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<number | null>(null)

  // ---------------------- 棋盤與狀態 ----------------------
  const [board, setBoard] = useState<Stone[][]>(
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  )
  const [currentColor, setCurrentColor] = useState<Stone>('black')

  // ---------------------- 提子數狀態 ----------------------
  const [blackCaptures, setBlackCaptures] = useState(0) // 黑方累計提走多少白子
  const [whiteCaptures, setWhiteCaptures] = useState(0) // 白方累計提走多少黑子

  // ---------------------- 結算規則 ----------------------
  const [selectedRule, setSelectedRule] = useState('chinese')

  // ---------------------- 計時 useEffect ----------------------
  useEffect(() => {
    if (timerActive) {
      timerRef.current = window.setInterval(() => {
        if (currentColor === 'black') {
          setBlackTime((prev) => prev + 1)
        } else if (currentColor === 'white') {
          setWhiteTime((prev) => prev + 1)
        }
      }, 1000)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timerActive, currentColor])

  // ---------------------- 工具函式：時間格式化 ----------------------
  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // ---------------------- 棋鐘控制 ----------------------
  const startTimer = () => setTimerActive(true)
  const pauseTimer = () => setTimerActive(false)
  const resetTimer = () => {
    setTimerActive(false)
    setBlackTime(0)
    setWhiteTime(0)
  }

  // ---------------------- 下子邏輯 ----------------------
  const handleClick = (x: number, y: number) => {
    // 若該點已有棋子則不下
    if (board[y][x] !== null) return

    // 若計時器沒開就自動啟動
    if (!timerActive) {
      startTimer()
    }

    // 放子
    const newBoard = board.map((row) => [...row])
    newBoard[y][x] = currentColor

    // 檢查是否提子（只檢查對手的群）
    const opponent = currentColor === 'black' ? 'white' : 'black'
    // 找到所有鄰接對手棋子的「群」，若該群無氣，則提走
    // 由於可能一次提多塊（如同時有兩塊白棋失去氣），要累計提子數
    let totalCaptured = 0

    // 四方向
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]

    for (let [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue
      if (newBoard[ny][nx] === opponent) {
        // 檢查「(nx,ny) 所在的對手群」是否還有氣
        const groupStones = getConnectedStones(newBoard, nx, ny, opponent)
        if (!hasLiberty(newBoard, groupStones)) {
          // 沒氣了 -> 提走
          totalCaptured += groupStones.length
          // 從棋盤上移除這些棋子
          groupStones.forEach(([gx, gy]) => {
            newBoard[gy][gx] = null
          })
        }
      }
    }

    // 如果有提子，更新提子數
    if (totalCaptured > 0) {
      if (currentColor === 'black') {
        setBlackCaptures((prev) => prev + totalCaptured) // 黑方提走白棋
      } else {
        setWhiteCaptures((prev) => prev + totalCaptured) // 白方提走黑棋
      }
    }

    setBoard(newBoard)

    // 和後端溝通的範例 (可自行斟酌)
    axios.post('http://localhost:8080/api/move', { x, y, color: currentColor })

    // 切換顏色
    setCurrentColor(opponent)
  }

  /**
   * 取得 (startX, startY) 所在「連通的同色群」座標列表
   * 同色 = board[y][x] === color
   */
  function getConnectedStones(
    boardData: Stone[][],
    startX: number,
    startY: number,
    color: Stone
  ): [number, number][] {
    const visited = new Set<string>()
    const queue: [number, number][] = [[startX, startY]]
    visited.add(`${startX},${startY}`)

    const result: [number, number][] = []
    result.push([startX, startY])

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!
      for (let [dx, dy] of directions) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue
        if (boardData[ny][nx] === color && !visited.has(`${nx},${ny}`)) {
          visited.add(`${nx},${ny}`)
          queue.push([nx, ny])
          result.push([nx, ny])
        }
      }
    }
    return result
  }

  /**
   * 檢查一個「連通同色群」是否仍有氣 (liberty)。
   * 只要該群周圍有任何一個空格即可判定有氣。
   */
  function hasLiberty(boardData: Stone[][], groupStones: [number, number][]) {
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (let [x, y] of groupStones) {
      for (let [dx, dy] of directions) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue
        if (boardData[ny][nx] === null) {
          // 發現空格，就有氣
          return true
        }
      }
    }
    return false
  }

  // ---------------------- 分數結算 ----------------------
  const handleSettle = () => {
    if (window.confirm('確定要結算現在的棋局嗎？')) {
      const { blackScore, whiteScore } = countScore(board, selectedRule)
      alert(
        `【結算】\n` +
        `黑方分數：${blackScore}\n` +
        `白方分數：${whiteScore}\n` +
        `\n規則：${translateRule(selectedRule)}` +
        `\n(黑提子: ${blackCaptures} / 白提子: ${whiteCaptures})`
      )
    }
  }

  /**
   * 根據 `board` 與 `selectedRule` (chinese / japanese)，回傳黑白雙方分數。
   * - 中國規則：空地 + 現存棋子數，不計提子
   * - 日本規則：空地 + 提子數（忽略死子、貼目等）
   */
  function countScore(boardData: Stone[][], rule: string) {
    // 先計算盤面上黑白棋子數
    let blackStones = 0
    let whiteStones = 0
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (boardData[y][x] === 'black') blackStones++
        if (boardData[y][x] === 'white') whiteStones++
      }
    }

    // 找「空地」歸屬 (territory)
    let blackTerritory = 0
    let whiteTerritory = 0
    const visited = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(false)
    )

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (boardData[y][x] === null && !visited[y][x]) {
          // 找到一塊空地
          const { count, belongsTo } = exploreEmptyArea(boardData, x, y, visited)
          if (belongsTo === 'black') blackTerritory += count
          else if (belongsTo === 'white') whiteTerritory += count
        }
      }
    }

    let blackScore = 0
    let whiteScore = 0

    if (rule === 'chinese') {
      // 中國規則：空地 + 現有棋子
      blackScore = blackTerritory + blackStones
      whiteScore = whiteTerritory + whiteStones
    } else if (rule === 'japanese') {
      // 日本規則：空地 + 提子 (簡化，未算死子)
      blackScore = blackTerritory + blackCaptures
      whiteScore = whiteTerritory + whiteCaptures
    }

    return { blackScore, whiteScore }
  }

  /**
   * BFS/DFS 找該區域空地，判斷歸屬
   * - 若僅挨到黑棋 => 該區域屬黑
   * - 若僅挨到白棋 => 該區域屬白
   * - 若同時挨到黑白或無挨到棋子 => 中立
   */
  function exploreEmptyArea(
    boardData: Stone[][],
    startX: number,
    startY: number,
    visited: boolean[][]
  ) {
    const queue = [[startX, startY]]
    visited[startY][startX] = true
    let count = 0
    const adjacentColors = new Set<Stone>()

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!
      count++

      for (let [dx, dy] of directions) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue
        if (boardData[ny][nx] === null) {
          if (!visited[ny][nx]) {
            visited[ny][nx] = true
            queue.push([nx, ny])
          }
        } else {
          adjacentColors.add(boardData[ny][nx]) // black / white
        }
      }
    }

    // 檢查該空地只鄰接單一顏色，則歸屬該色
    if (adjacentColors.size === 1) {
      const color = adjacentColors.values().next().value
      return { count, belongsTo: color as Stone } // black / white
    }
    return { count, belongsTo: null }
  }

  function translateRule(ruleValue: string) {
    switch (ruleValue) {
      case 'chinese':
        return '中國規則'
      case 'japanese':
        return '日本規則'
      default:
        return '未知規則'
    }
  }

  // ---------------------- UI ----------------------
  // x軸標籤（A-S，不含I）
  const xLabels = Array.from({ length: BOARD_SIZE }, (_, i) =>
    String.fromCharCode(65 + (i >= 8 ? i + 1 : i))
  )

  return (
    <div className="container py-4">
      <div className="top-bar text-center mb-4">
        {/* 開始、暫停、重置按鈕 */}
        <div className="timer-controls mb-3">
          {!timerActive ? (
            <button className="btn btn-success mx-1" onClick={startTimer}>
              開始
            </button>
          ) : (
            <button className="btn btn-warning mx-1" onClick={pauseTimer}>
              暫停
            </button>
          )}
          <button className="btn btn-danger mx-1" onClick={resetTimer}>
            重置
          </button>
        </div>
        {/* 目前輪到誰 */}
        <p className="mb-0">
          <span style={{ fontSize: '20px' }}>目前輪到：</span>
          <strong className={currentColor ?? ''} style={{ fontSize: '22px' }}>
            {currentColor === 'black' ? '黑子' : '白子'}
          </strong>
        </p>

      </div>

      <div className="board-area">
        {/* 左側計時與提子 */}
        <div className="side-panel">
          <div
            className={`player-timer ${currentColor === 'black' ? 'active-timer' : ''
              }`}
          >
            <div className="timer-label">黑方累積時間</div>
            <div className="timer-display">{formatTime(blackTime)}</div>
          </div>
          {/* 黑方提子顯示 */}
          <div className="capture-display mt-2">
            <span>黑方提子：{blackCaptures}</span>
          </div>
        </div>

        {/* 棋盤與坐標 */}
        <div className="board-center">
          {/* X 軸標籤 */}
          <div className="x-labels">
            {xLabels.map((label, i) => (
              <div key={`x-${i}`} className="coordinate-label x-label">
                {label}
              </div>
            ))}
          </div>

          <div className="board-with-y-labels">
            {/* Y 軸標籤 */}
            <div className="y-labels">
              {Array.from({ length: BOARD_SIZE }, (_, i) => (
                <div key={`y-${i}`} className="coordinate-label y-label">
                  {BOARD_SIZE - i}
                </div>
              ))}
            </div>

            {/* 棋盤 */}
            <div className="board">
              {board.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${x}-${y}`}
                    onClick={() => handleClick(x, y)}
                    className="cell"
                    data-x={x}
                    data-y={y}
                  >
                    {cell && <div className={`stone ${cell}`}></div>}
                    {/* 星位點 */}
                    {[
                      [3, 3], [3, 9], [3, 15],
                      [9, 3], [9, 9], [9, 15],
                      [15, 3], [15, 9], [15, 15],
                    ].some(([sx, sy]) => sx === x && sy === y) && (
                        <div className="star-point"></div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 棋盤下方操作 */}
          <div className="mt-3 text-center">
            <button
              className="btn btn-outline-secondary mt-2 mx-2"
              onClick={() => window.location.reload()}
            >
              重新開始
            </button>

            {/* 下拉：結算規則 */}
            <select
              className="form-select d-inline-block w-auto mx-2"
              value={selectedRule}
              onChange={(e) => setSelectedRule(e.target.value)}
            >
              <option value="chinese">中國規則</option>
              <option value="japanese">日本規則</option>
            </select>

            <button className="btn btn-primary mt-2 mx-2" onClick={handleSettle}>
              結算
            </button>
          </div>
        </div>

        {/* 右側計時與提子 */}
        <div className="side-panel">
          <div
            className={`player-timer ${currentColor === 'white' ? 'active-timer' : ''
              }`}
          >
            <div className="timer-label">白方累積時間</div>
            <div className="timer-display">{formatTime(whiteTime)}</div>
          </div>
          {/* 白方提子顯示 */}
          <div className="capture-display mt-2">
            <span>白方提子：{whiteCaptures}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
