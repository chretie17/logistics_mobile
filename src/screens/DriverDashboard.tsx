import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import apiService from '../services/api';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

type Product = {
  id: string;
  name: string;
};

type Order = {
  id: string;
  product: Product;
  quantity: number;
  status: string;
  deliveryAddress?: string;
  deliveryLatitude?: string;
  deliveryLongitude?: string;
  orderDeliveredAt?: string;
};

type LocationType = {
  latitude: number;
  longitude: number;
};

const DriverDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null);
  const [selectedOrderLocation, setSelectedOrderLocation] = useState<LocationType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchDriverOrders = async () => {
      if (!user || !user.id) {
        console.error('No user found or user ID is missing:', user);
        return;
      }

      try {
        const ordersData = await apiService.getOrdersByDriver(user.id);
        if (ordersData && Array.isArray(ordersData.data)) {
          setOrders(ordersData.data);
        } else {
          console.error('Unexpected data format:', ordersData);
          Alert.alert('Error', 'Failed to fetch orders.');
        }
      } catch (error) {
        console.error('Error occurred while fetching driver orders:', error);
        Alert.alert('Error', 'Failed to fetch orders.');
      }
    };

    fetchDriverOrders();
    const intervalId = setInterval(fetchDriverOrders, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [user]);

  useEffect(() => {
    const getCurrentLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    };

    getCurrentLocation();
  }, []);

  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      await apiService.markOrderAsDelivered(orderId);
      setOrders(orders.map(order =>
        order.id === orderId ? { ...order, status: 'Order Delivered', orderDeliveredAt: new Date().toISOString() } : order
      ));
      Alert.alert('Success', 'Order marked as delivered successfully.');
    } catch (error) {
      console.error('Error occurred while marking order as delivered:', error);
      Alert.alert('Error', 'Failed to mark order as delivered.');
    }
  };

  const handleOpenMapDialog = (order: Order) => {
    const location = {
      latitude: parseFloat(order.deliveryLatitude || '0'),
      longitude: parseFloat(order.deliveryLongitude || '0'),
    };

    if (location.latitude === 0 || location.longitude === 0) {
      console.error('Location is invalid:', location);
      Alert.alert('Error', 'Invalid location coordinates.');
      return;
    }

    setSelectedOrderLocation(location);
    setModalVisible(true);
  };

  const handleCloseMapDialog = () => {
    setModalVisible(false);
    setSelectedOrderLocation(null);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => logout() },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Your Assigned Orders</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView}>
        {orders.length > 0 ? (
          orders.map(order => (
            <View style={styles.card} key={order.id}>
              <View style={styles.cardContent}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <Text style={styles.productName}>Product: {order.product.name}</Text>
                <Text style={styles.text}>Quantity: {order.quantity}</Text>
                <Text style={styles.text}>Status: {order.status}</Text>
                <Text style={styles.text}>Delivery Location: {order.deliveryAddress || `${order.deliveryLatitude}, ${order.deliveryLongitude}`}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleOpenMapDialog(order)}
                  >
                    <Ionicons name="map-outline" size={20} color="white" />
                    <Text style={styles.buttonText}>View Location</Text>
                  </TouchableOpacity>
                  {order.status !== 'Order Delivered' && (
                    <TouchableOpacity
                      style={styles.deliverButton}
                      onPress={() => handleMarkAsDelivered(order.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                      <Text style={styles.buttonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noOrders}>No orders assigned to you currently.</Text>
        )}
      </ScrollView>

      {selectedOrderLocation && (
        <Modal
          visible={modalVisible}
          animationType="slide"
          onRequestClose={handleCloseMapDialog}
        >
          <View style={styles.modalContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: selectedOrderLocation.latitude,
                longitude: selectedOrderLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              {currentLocation && (
                <Marker coordinate={currentLocation} title="You" />
              )}
              <Marker coordinate={selectedOrderLocation} title="Destination" />
            </MapView>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseMapDialog}>
              <Text style={styles.closeButtonText}>Close Map</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#007BFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0056b3',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 10,
  },
  scrollView: {
    backgroundColor: '#f0f2f5',
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardContent: {
    flexDirection: 'column',
  },
  orderId: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    color: '#333',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#007BFF',
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 15,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 14,
  },
  noOrders: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default DriverDashboard;
