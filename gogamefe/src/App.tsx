import { useState } from 'react'
import './App.css'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'

const BOARD_SIZE = 19
type Stone = 'black' | 'white' | null

function App() {
  const [board, setBoard] = useState<Stone[][]>(
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  )
  const [currentColor, setCurrentColor] = useState<Stone>('black')

  const handleClick = (x: number, y: number) => {
    if (board[y][x] !== null) return

    const newBoard = board.map(row => [...row])
    newBoard[y][x] = currentColor
    setBoard(newBoard)

    axios.post('http://localhost:8080/api/move', {
      x,
      y,
      color: currentColor,
    })

    setCurrentColor(currentColor === 'black' ? 'white' : 'black')
  }

  return (
    <div className="container text-center py-4">
      <h1 className="mb-4">圍棋棋盤</h1>
      <div className="board mx-auto">
        {board.map((row, y) =>
          row.map((cell, x) => (
            <div key={`${x}-${y}`} onClick={() => handleClick(x, y)} className="cell">
              {cell && <div className={`stone ${cell}`}></div>}
              {/* 星位點 */}
              {[
                [3, 3], [3, 9], [3, 15],
                [9, 3], [9, 9], [9, 15],
                [15, 3], [15, 9], [15, 15]
              ].some(([sx, sy]) => sx === x && sy === y) && (
                  <div className="star-point"></div>
                )}
            </div>
          ))
        )}
      </div>

      <div className="mt-4">
        <p>目前輪到：<strong className={currentColor ?? ''}>
          {currentColor === 'black' ? '黑子' : currentColor === 'white' ? '白子' : ''}
        </strong>
        </p>
        <button className="btn btn-outline-secondary mt-2" onClick={() => window.location.reload()}>
          重新開始
        </button>
      </div>
    </div>
  )
}

export default App
