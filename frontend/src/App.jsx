import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import ConfigPage from './pages/ConfigPage';
import { colors } from './styles/theme';

const styles = {
  app: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '14px',
    color: colors.text,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <div style={styles.app}>
      {currentPage === 'dashboard' ? (
        <Dashboard onNavigate={setCurrentPage} />
      ) : (
        <ConfigPage onNavigate={setCurrentPage} />
      )}
    </div>
  );
}
