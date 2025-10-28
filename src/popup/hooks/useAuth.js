import { useState, useEffect } from 'react';
import { API_CONFIG } from '../../config/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_CONFIG.BASE_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // 检查登录状态
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const result = await chrome.storage.local.get([
        'accessToken',
        'refreshToken',
        'userInfo',
        'apiUrl',
        'loginTime'
      ]);

      if (result.accessToken && result.userInfo) {
        // 检查 token 是否过期（假设 token 有效期 1 小时）
        const loginTime = result.loginTime || 0;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (now - loginTime < oneHour) {
          setIsAuthenticated(true);
          setUserInfo(result.userInfo);
          setAccessToken(result.accessToken);
          setApiUrl(result.apiUrl || API_CONFIG.BASE_URL);
        } else {
          // Token 过期，尝试刷新
          await refreshToken(result.refreshToken, result.apiUrl);
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (refresh_token, api_url) => {
    try {
      const url = api_url || API_CONFIG.BASE_URL;
      const response = await fetch(`${url}${API_CONFIG.ENDPOINTS.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token })
      });

      if (response.ok) {
        const data = await response.json();
        await chrome.storage.local.set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          userInfo: data.user,
          loginTime: Date.now()
        });

        setIsAuthenticated(true);
        setUserInfo(data.user);
        setAccessToken(data.access_token);
        setApiUrl(api_url);
        setSessionExpired(false);
      } else {
        // 刷新失败，标记会话过期，不清除用户信息
        console.warn('Token 刷新失败，需要重新登录');
        setSessionExpired(true);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('刷新 token 失败:', error);
      setSessionExpired(true);
      setIsAuthenticated(false);
    }
  };

  const logout = async () => {
    await chrome.storage.local.remove([
      'accessToken',
      'refreshToken',
      'userInfo',
      'loginTime'
    ]);
    setIsAuthenticated(false);
    setUserInfo(null);
    setAccessToken(null);
  };

  return {
    isAuthenticated,
    userInfo,
    accessToken,
    apiUrl,
    isLoading,
    sessionExpired,
    logout,
    checkAuthStatus
  };
}

