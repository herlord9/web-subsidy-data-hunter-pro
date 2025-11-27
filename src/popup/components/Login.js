import React, { useState } from 'react';
import { API_CONFIG, getCurrentEnvName } from '../../config/api';

export function Login({ onLoginSuccess, sessionExpired }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('your-password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(API_CONFIG.getFullUrl(API_CONFIG.ENDPOINTS.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '登录失败');
      }

      const data = await response.json();
      
      // 保存 token 和用户信息
      await chrome.storage.local.set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        userInfo: data.user,
        apiUrl: API_CONFIG.BASE_URL,
        loginTime: Date.now()
      });

      console.log('登录成功:', data.user);
      
      // 显示成功提示
      alert(`✅ 登录成功！\n\n欢迎回来，${data.user.username || data.user.email}！`);
      
      onLoginSuccess(data);
    } catch (err) {
      console.error('登录错误:', err);
      setError(err.message || '登录失败，请检查邮箱和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🔐 登录 Data Hunter Pro</h2>
        <p className="login-subtitle">请登录以使用数据采集功能</p>

        {sessionExpired && !error && (
          <div style={{ 
            background: '#fff3cd', 
            border: '1px solid #ffc107',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#856404',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⏰</span>
            <div>
              <div style={{ fontWeight: '600' }}>会话已过期</div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>请重新登录以继续使用</div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 环境信息显示 */}
        <div style={{
          background: '#e7f3ff',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#004085',
          borderLeft: '4px solid #667eea',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🌐</span>
          <div>
            <div style={{ fontWeight: '600' }}>当前环境：{getCurrentEnvName()}</div>
            <div style={{ fontSize: '11px', color: '#0056b3', marginTop: '2px' }}>
              API: {API_CONFIG.BASE_URL}
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="login-form">

          <div className="form-group">
            <label htmlFor="email">邮箱</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              required
              disabled={isLoading}
              autoFocus
              autoComplete="username email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="login-footer">
          <small>💡 提示：当前使用 {getCurrentEnvName()}</small>
        </div>
      </div>
    </div>
  );
}

