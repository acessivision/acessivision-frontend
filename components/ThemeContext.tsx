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
    perigo: '#d40000ff',
    mensagemUsuario: '#fff',
    confirmar: '#66ff00ff'
  },
  dark: {
    texto: '#ECEDEE',
    barrasDeNavegacao: '#151718',
    tint: '#fff',
    icone: '#fff',
    tabIconDefault: '#fff',
    tabIconSelected: '#fff',
    fundo: '#636363',
    perigo: '#ff5249ff',
    mensagemUsuario: '#151718',
    confirmar: 'lime',
  },
};

// Base font sizes (these will be the maximum sizes)
export const BaseFontSizes = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
  xxlarge: 26,
};

// Base icon sizes (these will be the maximum sizes)
export const BaseIconSizes = {
  small: 20,
  medium: 24,
  large: 30,
  xlarge: 50,
};

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: Theme;
  temaAplicado: 'light' | 'dark';
  mudaTema: () => void;
  setTheme: (t: Theme) => void;
  cores: typeof Cores.light;
  fontScale: number;
  setFontScale: (scale: number) => void;
  getFontSize: (size: keyof typeof BaseFontSizes) => number;
  getIconSize: (size: keyof typeof BaseIconSizes) => number;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'system',
  temaAplicado: 'light',
  mudaTema: () => {},
  setTheme: () => {},
  cores: Cores.light,
  fontScale: 1,
  setFontScale: () => {},
  getFontSize: () => 16,
  getIconSize: () => 24,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme() || 'light';
  const [theme, setTheme] = useState<Theme>('system');
  const [temaAplicado, setTemaAplicado] = useState<'light' | 'dark'>(systemTheme);
  const [fontScale, setFontScale] = useState<number>(1);

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem('app-theme');
      const savedFontScale = await AsyncStorage.getItem('app-font-scale');
      
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setTheme(savedTheme);
      }
      
      if (savedFontScale) {
        setFontScale(parseFloat(savedFontScale));
      }
    })();
  }, []);

  useEffect(() => {
    const finalTheme = theme === 'system' ? systemTheme : theme;
    setTemaAplicado(finalTheme);
    AsyncStorage.setItem('app-theme', theme);
  }, [theme, systemTheme]);

  useEffect(() => {
    AsyncStorage.setItem('app-font-scale', fontScale.toString());
  }, [fontScale]);

  const mudaTema = () => {
    setTheme((prev) => {
      const current = prev === 'system' ? systemTheme : prev;
      return current === 'light' ? 'dark' : 'light';
    });
  };

  const getFontSize = (size: keyof typeof BaseFontSizes): number => {
    return Math.round(BaseFontSizes[size] * fontScale);
  };

  const getIconSize = (size: keyof typeof BaseIconSizes): number => {
    return Math.round(BaseIconSizes[size] * fontScale);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        temaAplicado,
        mudaTema,
        setTheme,
        cores: Cores[temaAplicado],
        fontScale,
        setFontScale,
        getFontSize,
        getIconSize,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);