import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Dosyaları doğru yollardan çağırıyoruz
import HomeScreen from './HomeScreen';
import DetailsScreen from './DetailsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerTintColor: '#D8A7B1',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* İşte burası HomeScreen'i devreye sokacak satır */}
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Venue Keşfet' }} 
        />
        <Stack.Screen 
          name="Details" 
          component={DetailsScreen} 
          options={{ title: 'Mekan Detayı' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}