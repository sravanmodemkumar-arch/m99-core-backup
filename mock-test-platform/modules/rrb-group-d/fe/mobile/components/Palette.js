import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { isTablet } from '../utils/layout'

const COLORS = {
  not_visited    : '#9E9E9E',
  not_answered   : '#E53935',
  answered       : '#43A047',
  marked_review  : '#8E24AA',
  answered_marked: '#6A1B9A',
}

function qState(qno, answers, flags, visited) {
  const v = visited.includes(qno)
  const a = !!answers[qno]
  const f = !!flags[qno]
  if (!v)       return 'not_visited'
  if (a && f)   return 'answered_marked'
  if (a)        return 'answered'
  if (f)        return 'marked_review'
  return 'not_answered'
}

export default function Palette({ config, answers, flags, visited, currentQ, onPress, sidebar }) {
  const cols = isTablet() ? 6 : 5

  return (
    <View style={[styles.container, sidebar && styles.sidebar]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Question Palette</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(COLORS).map(([state, color]) => (
          <View key={state} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{state.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {config.sections.map(sec => (
          <View key={sec.sid} style={styles.section}>
            <Text style={styles.sectionLabel}>{sec.label.en}</Text>
            <View style={[styles.buttons, { flexWrap: 'wrap', flexDirection: 'row' }]}>
              {Array.from({ length: sec.q_count }, (_, i) => {
                const qno   = sec.q_from + i
                const state = qState(qno, answers, flags, visited)
                const cur   = qno === currentQ
                return (
                  <TouchableOpacity
                    key={qno}
                    style={[
                      styles.btn,
                      { backgroundColor: COLORS[state] },
                      cur && styles.btnCurrent,
                    ]}
                    onPress={() => onPress(qno)}
                  >
                    <Text style={styles.btnText}>{qno}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container   : { backgroundColor: '#F8F9FA' },
  sidebar     : { width: 220, borderLeftWidth: 1, borderLeftColor: '#DEE2E6' },
  header      : { backgroundColor: '#2D5986', paddingHorizontal: 12, paddingVertical: 8 },
  headerText  : { color: '#fff', fontSize: 13, fontWeight: '600' },
  legend      : { paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  legendItem  : { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  legendDot   : { width: 12, height: 12, borderRadius: 2 },
  legendLabel : { fontSize: 10, color: '#555', textTransform: 'capitalize' },
  grid        : { padding: 8 },
  section     : { marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 4 },
  buttons     : { gap: 4 },
  btn         : { width: 32, height: 32, borderRadius: 4, alignItems: 'center', justifyContent: 'center', margin: 2 },
  btnCurrent  : { borderWidth: 2, borderColor: '#F57F17' },
  btnText     : { color: '#fff', fontSize: 11, fontWeight: '600' },
})
