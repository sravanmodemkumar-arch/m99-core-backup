import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QuestionCard from './components/QuestionCard'
import Palette      from './components/Palette'
import Timer        from './components/Timer'
import ActionBar    from './components/ActionBar'
import { saveAnswer, clearAnswer, toggleFlag } from './services/api'
import { enqueue }                             from './services/storage'
import { checkAndFlush }                       from './services/sync'
import { isTablet }                            from './utils/layout'

export default function ExamScreen({ route, navigation }) {
  const { tsf, bundle, config, token, moduleApi } = route.params
  const insets = useSafeAreaInsets()

  const [answers, setAnswers]     = useState(tsf?.state?.answers ?? {})
  const [flags, setFlags]         = useState(tsf?.state?.flags ?? {})
  const [visited, setVisited]     = useState(tsf?.state?.visited ?? [])
  const [currentQ, setCurrentQ]   = useState(1)
  const [showPalette, setShowPalette] = useState(isTablet())

  const qContent = bundle?.questions?.[currentQ]

  const goTo = useCallback((qno) => {
    setCurrentQ(qno)
    setVisited(v => v.includes(qno) ? v : [...v, qno])
  }, [])

  const onSelect = useCallback(async (key) => {
    const updated = { ...answers, [currentQ]: { v: [key] } }
    setAnswers(updated)
    setVisited(v => v.includes(currentQ) ? v : [...v, currentQ])
    saveAnswer(moduleApi, tsf.test_id, token, currentQ, [key]).catch(() => {})
  }, [answers, currentQ])

  const onClear = useCallback(async () => {
    const updated = { ...answers }
    delete updated[currentQ]
    setAnswers(updated)
    clearAnswer(moduleApi, tsf.test_id, token, currentQ).catch(() => {})
  }, [answers, currentQ])

  const onMarkReview = useCallback(() => {
    const updated = { ...flags }
    if (updated[currentQ]) delete updated[currentQ]
    else updated[currentQ] = true
    setFlags(updated)
    toggleFlag(moduleApi, tsf.test_id, token, currentQ).catch(() => {})
    goTo(Math.min(currentQ + 1, config.totals.q_count))
  }, [flags, currentQ])

  const onSubmit = useCallback(() => {
    Alert.alert(
      'Submit Exam?',
      `Answered: ${Object.keys(answers).length}\nNot Answered: ${config.totals.q_count - Object.keys(answers).length}`,
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Yes, Submit', style: 'destructive', onPress: handleSubmit },
      ]
    )
  }, [answers])

  const handleSubmit = useCallback(async () => {
    const answerKey = bundle?.answer_key ?? {}
    const marking   = config.marking.default
    let score = 0, correct = 0, wrong = 0, unattempted = 0

    const perSection = config.sections.map(sec => {
      let ss = 0, sc = 0, sw = 0, su = 0
      for (let qno = sec.q_from; qno <= sec.q_to; qno++) {
        const student = answers[qno]?.v ?? []
        const key     = answerKey[qno] ?? []
        if (student.length === 0) { unattempted++; su++ }
        else if (JSON.stringify([...student].sort()) === JSON.stringify([...key].sort())) {
          score += marking.correct; ss += marking.correct; correct++; sc++
        } else {
          score -= marking.wrong; ss -= marking.wrong; wrong++; sw++
        }
      }
      return { sid: sec.sid, label: sec.label.en, score: ss, correct: sc, wrong: sw, unattempted: su }
    })

    await enqueue({
      test_id     : tsf.test_id,
      module_id   : 'rrb-group-d',
      score, correct, wrong, unattempted,
      per_section : JSON.stringify(perSection),
      answers     : JSON.stringify(answers),
      submitted_at: new Date().toISOString(),
    })

    await checkAndFlush(moduleApi, token)
    navigation.replace('Result', { score, correct, wrong, unattempted, perSection, config })
  }, [answers])

  const tablet = isTablet()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.examName}>{config.header.exam_name.en}</Text>
        </View>
        <Timer totalSec={config.schedule.duration_sec} onExpire={handleSubmit} />
        {!tablet && (
          <TouchableOpacity onPress={() => setShowPalette(p => !p)} style={styles.paletteToggle}>
            <Text style={styles.paletteToggleText}>☰</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main */}
      <View style={styles.main}>
        {tablet ? (
          <>
            <ScrollView style={styles.questionArea}>
              <QuestionCard
                qno={currentQ} content={qContent}
                selected={answers[currentQ]?.v ?? []}
                onSelect={onSelect}
              />
            </ScrollView>
            <Palette
              config={config} answers={answers} flags={flags} visited={visited}
              currentQ={currentQ} onPress={goTo} sidebar
            />
          </>
        ) : (
          showPalette ? (
            <Palette
              config={config} answers={answers} flags={flags} visited={visited}
              currentQ={currentQ} onPress={q => { goTo(q); setShowPalette(false) }}
            />
          ) : (
            <ScrollView style={styles.questionArea}>
              <QuestionCard
                qno={currentQ} content={qContent}
                selected={answers[currentQ]?.v ?? []}
                onSelect={onSelect}
              />
            </ScrollView>
          )
        )}
      </View>

      {/* Action Bar */}
      <ActionBar
        onMarkReview={onMarkReview} onClear={onClear}
        onPrev={() => goTo(Math.max(currentQ - 1, 1))}
        onNext={() => goTo(Math.min(currentQ + 1, config.totals.q_count))}
        onSubmit={onSubmit}
        insets={insets}
      />

    </View>
  )
}

const styles = StyleSheet.create({
  container      : { flex: 1, backgroundColor: '#F5F5F5' },
  header         : { backgroundColor: '#1A3A5C', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  examName       : { color: '#fff', fontSize: 13, fontWeight: '600' },
  main           : { flex: 1, flexDirection: 'row' },
  questionArea   : { flex: 1 },
  paletteToggle  : { padding: 8 },
  paletteToggleText: { color: '#fff', fontSize: 18 },
})
