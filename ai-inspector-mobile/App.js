import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { colors } from './src/theme/colors';

import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: colors.purpleLight,
        tabBarInactiveTintColor: '#C0C9D5',

        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: '#1F324B',
          height: 74,
          paddingTop: 8,
          paddingBottom: 8,
        },

        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home',
            History: 'time-outline',
            Inspect: 'camera',
            Stats: 'stats-chart',
            Profile: 'person-outline',
          };

          return (
            <Ionicons
              name={icons[route.name]}
              color={color}
              size={route.name === 'Inspect' ? 29 : size}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tab.Screen
        name="History"
        component={HistoryScreen}
      />

      <Tab.Screen
        name="Inspect"
        component={CameraScreen}
        options={{
          tabBarLabel: '',
        }}
      />

      <Tab.Screen
        name="Stats"
        component={StatsScreen}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />

      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
        />

        <Stack.Screen
          name="Result"
          component={ResultScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}