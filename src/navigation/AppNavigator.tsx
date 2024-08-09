import React, { useContext, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../screens/LoginScreen';
import DriverDashboard from '../screens/DriverDashboard';
import { AuthContext } from '../context/AuthContext';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    console.log('Navigating based on user authentication status:', user);
  }, [user]);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="Dashboard" component={DriverDashboard} options={{ headerTitle: 'Driver Dashboard' }} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
