import React, { useEffect } from 'react'
import { AppState } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import HomeScreen   from './HomeScreen'
import LoginScreen  from './LoginScreen'

// ── Exam screens — one import per module ──────────────────────────────────────
import ExamScreen   from '../../rrb-group-d/fe/mobile/ExamScreen'
import ResultScreen from '../../rrb-group-d/fe/mobile/ResultScreen'
// import RRBNTPCExam   from '../../rrb-ntpc/fe/mobile/ExamScreen'      (add when module exists)
// import SSCCGLExam    from '../../ssc-cgl/fe/mobile/ExamScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  // Check batch flush on every foreground resume
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Each module's sync runs when its exam screen is opened
        // App-level: could check a global queue here in future
      }
    })
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login"   component={LoginScreen} />
          <Stack.Screen name="Home"    component={HomeScreen} />
          <Stack.Screen name="RRBGroupDExam"   component={ExamScreen} />
          <Stack.Screen name="RRBGroupDResult" component={ResultScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
