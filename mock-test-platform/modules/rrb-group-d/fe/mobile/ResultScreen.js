import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ResultScreen({ route, navigation }) {
  const { score, correct, wrong, unattempted, perSection, config } = route.params
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
    >
      <Text style={styles.title}>Exam Result</Text>

      {/* Score Box */}
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{score.toFixed(2)}</Text>
        <Text style={styles.scoreLabel}>out of {config.totals.q_count} marks</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.correct}>✅ Correct: {correct}</Text>
          <Text style={styles.wrong}>  ❌ Wrong: {wrong}</Text>
          <Text style={styles.unattempted}>  — Unattempted: {unattempted}</Text>
        </View>
      </View>

      {/* Section Breakdown */}
      <View style={styles.table}>
        <View style={[styles.row, styles.tableHead]}>
          <Text style={[styles.cell, { flex: 2 }]}>Section</Text>
          <Text style={styles.cell}>Score</Text>
          <Text style={styles.cell}>✅</Text>
          <Text style={styles.cell}>❌</Text>
        </View>
        {perSection.map(s => (
          <View key={s.sid} style={styles.row}>
            <Text style={[styles.cell, { flex: 2, textAlign: 'left' }]}>{s.label}</Text>
            <Text style={[styles.cell, { fontWeight: '600' }]}>{s.score.toFixed(2)}</Text>
            <Text style={[styles.cell, { color: '#43A047' }]}>{s.correct}</Text>
            <Text style={[styles.cell, { color: '#E53935' }]}>{s.wrong}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => navigation.popToTop()}>
        <Text style={styles.btnText}>Take Another Test</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#F5F5F5' },
  title        : { fontSize: 22, fontWeight: 'bold', color: '#1A3A5C', marginBottom: 16 },
  scoreBox     : { backgroundColor: '#fff', borderRadius: 8, padding: 20, marginBottom: 16, alignItems: 'center' },
  score        : { fontSize: 48, fontWeight: 'bold', color: '#1A3A5C' },
  scoreLabel   : { color: '#888', marginTop: 4 },
  scoreRow     : { flexDirection: 'row', marginTop: 12 },
  correct      : { color: '#43A047', fontSize: 13 },
  wrong        : { color: '#E53935', fontSize: 13 },
  unattempted  : { color: '#9E9E9E', fontSize: 13 },
  table        : { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  tableHead    : { backgroundColor: '#F5F5F5' },
  row          : { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  cell         : { flex: 1, textAlign: 'center', fontSize: 13 },
  btn          : { backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  btnText      : { color: '#fff', fontWeight: '600', fontSize: 15 },
})
