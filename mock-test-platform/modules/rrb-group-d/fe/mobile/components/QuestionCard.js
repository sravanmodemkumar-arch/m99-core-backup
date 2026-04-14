import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

export default function QuestionCard({ qno, content, selected, onSelect }) {
  if (!content) return <Text style={styles.loading}>Loading question…</Text>

  return (
    <View style={styles.container}>
      <Text style={styles.qno}>Question {qno}</Text>
      <Text style={styles.qtext}>{content.text_en}</Text>
      <View style={styles.options}>
        {content.options.map(opt => {
          const isSelected = selected.includes(opt.key)
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onSelect(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optKey, isSelected && styles.optKeySelected]}>{opt.key}</Text>
              <Text style={[styles.optText, isSelected && styles.optTextSelected]}>{opt.text_en}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container      : { backgroundColor: '#fff', margin: 8, borderRadius: 8, padding: 16 },
  loading        : { color: '#aaa', textAlign: 'center', marginTop: 40 },
  qno            : { fontSize: 12, color: '#888', marginBottom: 8 },
  qtext          : { fontSize: 16, color: '#212121', lineHeight: 24, marginBottom: 16 },
  options        : { gap: 8 },
  option         : { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 6, padding: 12, backgroundColor: '#fff' },
  optionSelected : { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  optKey         : { fontSize: 14, fontWeight: '700', color: '#424242', width: 24 },
  optKeySelected : { color: '#1565C0' },
  optText        : { fontSize: 14, color: '#424242', flex: 1 },
  optTextSelected: { color: '#1565C0' },
})
