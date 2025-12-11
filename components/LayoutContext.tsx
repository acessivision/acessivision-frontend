import React, { createContext, useState, useContext, ReactNode } from 'react';

interface LayoutContextProps {
  headerHeight: number;
  setHeaderHeight: (height: number) => void;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [headerHeight, setHeaderHeight] = useState(60);

  return (
    <LayoutContext.Provider value={{ headerHeight, setHeaderHeight }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};