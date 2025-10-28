import React from 'react';

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <div>{message}</div>
    </div>
  );
}
