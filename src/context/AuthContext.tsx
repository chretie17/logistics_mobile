import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api'; // Import the ApiService instance

type AuthContextType = {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = await AsyncStorage.getItem('token');
      console.log('Loaded token from storage:', token); // Debugging log
      if (token) {
        const decodedToken = apiService.decodeToken(token);
        if (decodedToken) {
          setUser({ token, id: decodedToken.id, role: decodedToken.role });
          apiService.setAuthToken(token); // Set the auth token for future API calls
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userData = await apiService.login(email, password);
      setUser(userData); // Update the user state with the returned data
      console.log('User logged in, token saved:', userData.token); // Debugging log
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    await apiService.logout();
    setUser(null);
    console.log('User logged out, token removed'); // Debugging log
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
