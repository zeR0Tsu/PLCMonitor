import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import ConfigPage from './pages/ConfigPage';

const styles = {
  app: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    fontSize: '14px',
    color: '#333',
    backgroundColor: '#f5f5f5',
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
