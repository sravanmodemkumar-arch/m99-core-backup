import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

export default function ActionBar({ onMarkReview, onClear, onPrev, onNext, onSubmit, insets }) {
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.left}>
        <TouchableOpacity style={[styles.btn, styles.purple]} onPress={onMarkReview}>
          <Text style={styles.btnTextLight}>Mark &amp; Next</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.outline]} onPress={onClear}>
          <Text style={styles.btnTextDark}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.right}>
        <TouchableOpacity style={[styles.btn, styles.outline]} onPress={onPrev}>
          <Text style={styles.btnTextDark}>← Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.blue]} onPress={onNext}>
          <Text style={styles.btnTextLight}>Next →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.red]} onPress={onSubmit}>
          <Text style={styles.btnTextLight}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar          : { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 8, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between' },
  left         : { flexDirection: 'row', gap: 6 },
  right        : { flexDirection: 'row', gap: 6 },
  btn          : { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  purple       : { backgroundColor: '#8E24AA' },
  blue         : { backgroundColor: '#1565C0' },
  red          : { backgroundColor: '#E53935' },
  outline      : { borderWidth: 1, borderColor: '#BDBDBD', backgroundColor: '#fff' },
  btnTextLight : { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnTextDark  : { color: '#424242', fontSize: 12 },
})
