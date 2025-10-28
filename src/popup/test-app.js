import React from 'react';
import ReactDOM from 'react-dom/client';

// 简单的测试组件
function TestApp() {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🕵️‍♂️ Data Hunter Pro</h1>
      <p>Extension is working!</p>
      <button 
        style={{
          background: '#667eea',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        onClick={() => {
          console.log('Button clicked!');
          alert('Data Hunter Pro is working!');
        }}
      >
        Test Button
      </button>
    </div>
  );
}

// 渲染应用
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TestApp />);
