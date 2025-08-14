import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Cores = {
  light: {
    texto: '#11181C',
    barrasDeNavegacao: '#fff',
    tint: '#0a7ea4',
    icone: '#000',
    tabIconDefault: '#000',
    tabIconSelected: '#0a7ea4',
    fundo: '#f4f4f4',
  },
  dark: {
    texto: '#ECEDEE',
    barrasDeNavegacao: '#151718',
    tint: '#fff',
    icone: '#fff',
    tabIconDefault: '#fff',
    tabIconSelected: '#fff',
    fundo: '#636363',
  },
};

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: Theme;
  temaAplicado: 'light' | 'dark';
  mudaTema: () => void;
  setTheme: (t: Theme) => void;
  cores: typeof Cores.light;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'system',
  temaAplicado: 'light',
  mudaTema: () => {},
  setTheme: () => {},
  cores: Cores.light,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme() || 'light';
  const [theme, setTheme] = useState<Theme>('system');
  const [temaAplicado, setTemaAplicado] = useState<'light' | 'dark'>(systemTheme);

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem('app-theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setTheme(savedTheme);
      }
    })();
  }, []);

  useEffect(() => {
    const finalTheme = theme === 'system' ? systemTheme : theme;
    setTemaAplicado(finalTheme);
    AsyncStorage.setItem('app-theme', theme);
  }, [theme, systemTheme]);

  const mudaTema = () => {
    setTheme((prev) => {
      const current = prev === 'system' ? systemTheme : prev;
      return current === 'light' ? 'dark' : 'light';
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        temaAplicado,
        mudaTema,
        setTheme,
        cores: Cores[temaAplicado],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
