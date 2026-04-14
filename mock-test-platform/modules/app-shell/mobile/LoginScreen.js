import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [phone, setPhone]     = useState('')
  const [loading, setLoading] = useState(false)

  const onLogin = async () => {
    if (phone.length < 10) { Alert.alert('Enter a valid phone number'); return }
    setLoading(true)
    try {
      const res = await fetch('https://auth.m99-core.com/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ phone }),
      })
      const { token, user } = await res.json()
      navigation.replace('Home', { token, user })
    } catch {
      Alert.alert('Login failed', 'Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.brand}>m99</Text>
        <Text style={styles.tagline}>Mock Test Platform</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={onLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Logging in…' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A3A5C' },
  hero     : { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand    : { color: '#fff', fontSize: 48, fontWeight: 'bold', letterSpacing: 2 },
  tagline  : { color: '#B0BEC5', fontSize: 14, marginTop: 4 },
  form     : { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  label    : { fontSize: 14, color: '#555', marginBottom: 6 },
  input    : { borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  btn      : { backgroundColor: '#1A3A5C', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  btnText  : { color: '#fff', fontWeight: '700', fontSize: 15 },
})
