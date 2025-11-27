import { useState, useEffect } from 'react';
import { API_CONFIG } from '../../config/api';

export function useAuth() {
  // ========== 登录验证已禁用 - 插件可直接使用 ==========
  const [isAuthenticated, setIsAuthenticated] = useState(true); // 直接设为 true，无需登录
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_CONFIG.BASE_URL);
  const [isLoading, setIsLoading] = useState(false); // 不需要加载
  const [sessionExpired, setSessionExpired] = useState(false);

  // ========== 以下登录验证代码已注释 ==========
  // // 检查登录状态
  // useEffect(() => {
  //   checkAuthStatus();
  // }, []);

  // const checkAuthStatus = async () => {
  //   try {
  //     const result = await chrome.storage.local.get([
  //       'accessToken',
  //       'refreshToken',
  //       'userInfo',
  //       'apiUrl',
  //       'loginTime'
  //     ]);

  //     if (result.accessToken && result.userInfo) {
  //       // 检查 token 是否过期（假设 token 有效期 1 小时）
  //       const loginTime = result.loginTime || 0;
  //       const now = Date.now();
  //       const oneHour = 60 * 60 * 1000;

  //       if (now - loginTime < oneHour) {
  //         setIsAuthenticated(true);
  //         setUserInfo(result.userInfo);
  //         setAccessToken(result.accessToken);
  //         setApiUrl(result.apiUrl || API_CONFIG.BASE_URL);
  //       } else {
  //         // Token 过期，尝试刷新
  //         await refreshToken(result.refreshToken, result.apiUrl);
  //       }
  //     }
  //   } catch (error) {
  //     console.error('检查登录状态失败:', error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // ========== Token 刷新功能已注释 ==========
  // const refreshToken = async (refresh_token, api_url) => {
  //   try {
  //     const url = api_url || API_CONFIG.BASE_URL;
  //     const response = await fetch(`${url}${API_CONFIG.ENDPOINTS.REFRESH}`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ refresh_token })
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       await chrome.storage.local.set({
  //         accessToken: data.access_token,
  //         refreshToken: data.refresh_token,
  //         userInfo: data.user,
  //         loginTime: Date.now()
  //       });

  //       setIsAuthenticated(true);
  //       setUserInfo(data.user);
  //       setAccessToken(data.access_token);
  //       setApiUrl(api_url);
  //       setSessionExpired(false);
  //     } else {
  //       // 刷新失败，标记会话过期，不清除用户信息
  //       console.warn('Token 刷新失败，需要重新登录');
  //       setSessionExpired(true);
  //       setIsAuthenticated(false);
  //     }
  //   } catch (error) {
  //     console.error('刷新 token 失败:', error);
  //     setSessionExpired(true);
  //     setIsAuthenticated(false);
  //   }
  // };

  // ========== 登出功能已注释 ==========
  const logout = async () => {
    // 登出功能已禁用
    // await chrome.storage.local.remove([
    //   'accessToken',
    //   'refreshToken',
    //   'userInfo',
    //   'loginTime'
    // ]);
    // setIsAuthenticated(false);
    // setUserInfo(null);
    // setAccessToken(null);
  };

  // ========== checkAuthStatus 已禁用 ==========
  const checkAuthStatus = async () => {
    // 登录验证已禁用，无需检查
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

