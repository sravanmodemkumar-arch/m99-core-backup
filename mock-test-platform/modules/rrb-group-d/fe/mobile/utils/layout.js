import { Dimensions } from 'react-native'

// Tablet = width >= 768px (covers iPad, Android tablets, foldables)
export const isTablet = () => Dimensions.get('window').width >= 768
