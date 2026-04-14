import React from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Module registry — add entry when a new module is built
const MODULES = [
  {
    id        : 'rrb-group-d',
    name      : 'RRB Group D CBT',
    subtitle  : 'Railway Recruitment Board',
    screen    : 'RRBGroupDExam',
    color     : '#1A3A5C',
  },
  // { id: 'rrb-ntpc', name: 'RRB NTPC', screen: 'RRBNTPCExam', color: '#1A3A5C' },
  // { id: 'ssc-cgl',  name: 'SSC CGL',  screen: 'SSCCGLExam',  color: '#2E7D32' },
]

export default function HomeScreen({ navigation, route }) {
  const { token, user } = route.params ?? {}
  const insets = useSafeAreaInsets()

  const openExam = (mod) => {
    // In real flow: fetch available mock tests from platform API
    // For now: navigate with module info
    navigation.navigate(mod.screen, {
      moduleApi: `https://${mod.id}.m99-core.com/exam/${mod.id}`,
      token,
      tsf   : null,  // fetched by ExamScreen
      bundle: null,  // fetched by ExamScreen
      config: null,  // fetched by ExamScreen
    })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Tests</Text>
        <Text style={styles.subtitle}>Welcome, {user?.name ?? 'Student'}</Text>
      </View>

      <FlatList
        data={MODULES}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: item.color }]}
            onPress={() => openExam(item)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardTitle, { color: item.color }]}>{item.name}</Text>
            {item.subtitle && <Text style={styles.cardSub}>{item.subtitle}</Text>}
            <Text style={styles.cardAction}>Take Mock Test →</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: '#F5F5F5' },
  header    : { backgroundColor: '#1A3A5C', padding: 16 },
  title     : { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  subtitle  : { color: '#B0BEC5', fontSize: 13, marginTop: 2 },
  card      : { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderLeftWidth: 4 },
  cardTitle : { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSub   : { fontSize: 13, color: '#666', marginBottom: 8 },
  cardAction: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
})
