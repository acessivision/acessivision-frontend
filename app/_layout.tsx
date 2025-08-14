import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';

function ThemedSystemBars() {
  const { theme } = useTheme();

  useEffect(() => {
    NavigationBar.setButtonStyleAsync(
      theme === 'dark' ? 'light' : 'dark'
    );
  }, [theme]);

  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedSystemBars />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
