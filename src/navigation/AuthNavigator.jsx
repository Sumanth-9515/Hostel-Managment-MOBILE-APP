import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator({ onAuth }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">{props => <LoginScreen {...props} onAuth={onAuth} />}</Stack.Screen>
      <Stack.Screen name="Register">{props => <RegisterScreen {...props} onAuth={onAuth} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
