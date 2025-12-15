import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if subscription has expired and auto-logout
  const checkSubscriptionExpiry = (userData) => {
    if (!userData) return false;
    if (userData.subscriptionType === 'permanent') return false;
    const expires = userData.subscriptionExpires ? new Date(userData.subscriptionExpires) : null;
    if (!expires || isNaN(expires)) return true; // expired if no expiry date
    return expires.getTime() < Date.now(); // expired if in the past
  };

  useEffect(() => {
    const userCode = localStorage.getItem('userCode');
    const userData = localStorage.getItem('userData');

    if (userCode && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // Check if subscription has expired
        if (checkSubscriptionExpiry(parsedUser)) {
          localStorage.removeItem('userCode');
          localStorage.removeItem('userData');
          setUser(null);
          setIsLoggedIn(false);
        } else {
          setUser(parsedUser);
          setIsLoggedIn(true);
        }
      } catch (e) {
        // parsing user data failed (silenced in production)
        localStorage.removeItem('userCode');
        localStorage.removeItem('userData');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, userCode) => {
    localStorage.setItem('userCode', userCode);
    localStorage.setItem('userData', JSON.stringify(userData));
    setUser(userData);
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem('userCode');
    localStorage.removeItem('userData');
    setUser(null);
    setIsLoggedIn(false);
  };

  // Periodic check for subscription expiry (every 30 seconds)
  useEffect(() => {
    if (!isLoggedIn || !user) return;

    const interval = setInterval(() => {
      if (checkSubscriptionExpiry(user)) {
        logout();
        window.location.href = '/login?expired=1';
      }
    }, 30000); // check every 30 seconds

    return () => clearInterval(interval);
  }, [isLoggedIn, user]);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
