import React, { useState, useEffect, useRef } from 'react'
import { Text, StyleSheet } from 'react-native'

export default function Timer({ totalSec, onExpire }) {
  const [remaining, setRemaining] = useState(totalSec)
  const ref = useRef(null)

  useEffect(() => {
    ref.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(ref.current); onExpire(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(ref.current)
  }, [])

  const h = String(Math.floor(remaining / 3600)).padStart(2, '0')
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')
  const s = String(remaining % 60).padStart(2, '0')

  const color = remaining < 300 ? '#FF5252' : remaining < 600 ? '#FFB300' : '#fff'

  return <Text style={[styles.timer, { color }]}>{h}:{m}:{s}</Text>
}

const styles = StyleSheet.create({
  timer: { fontVariant: ['tabular-nums'], fontSize: 18, fontWeight: 'bold' },
})
