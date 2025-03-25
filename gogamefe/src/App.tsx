// App.tsx
import { useEffect, useRef } from 'react'
import './App.css'
import axios from 'axios'

function App() {
  const boardRef = useRef<HTMLDivElement>(null)
  const boardInstance = useRef<any>(null)

  useEffect(() => {
    // @ts-ignore: WGo is from global
    if (window.WGo && boardRef.current && !boardInstance.current) {
      boardInstance.current = new window.WGo.Board(boardRef.current, {
        width: 400,
        section: {
          top: -1,
          left: -1,
          right: -1,
          bottom: -1,
        },
      })

      boardRef.current.addEventListener('click', (e: MouseEvent) => {
        const boundingRect = boardRef.current!.getBoundingClientRect()
        const x = e.clientX - boundingRect.left
        const y = e.clientY - boundingRect.top

        const coords = boardInstance.current.getCoordinates(x, y)
        const [i, j] = coords

        boardInstance.current.addObject({
          type: 'stone',
          c: i,
          l: j,
          color: boardInstance.current.stone_color || 1,
        })

        // Toggle color (1 = black, -1 = white)
        boardInstance.current.stone_color =
          boardInstance.current.stone_color === 1 ? -1 : 1

        axios.post('http://localhost:8080/api/move', {
          x: i,
          y: j,
          color: boardInstance.current.stone_color === 1 ? 'white' : 'black',
        })
      })
    }
  }, [])

  return (
    <div>
      <h1>圍棋對局</h1>
      <div ref={boardRef} id="board" style={{ margin: 'auto' }}></div>
    </div>
  )
}

export default App
