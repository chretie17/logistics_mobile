import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, SafeAreaView, StyleSheet, StatusBar, Dimensions, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import apiService from '../services/api';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

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

const { width } = Dimensions.get('window');

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
    const intervalId = setInterval(fetchDriverOrders, 30000);
    return () => clearInterval(intervalId);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Order Delivered':
        return '#28a745';
      case 'In Progress':
        return '#ffc107';
      default:
        return '#007bff';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Your Assigned Orders</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {orders.length > 0 ? (
          orders.map(order => (
            <View style={styles.card} key={order.id}>
              <View style={styles.cardHeader}>
                <View style={styles.orderIdContainer}>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.productInfo}>
                  <Ionicons name="cube-outline" size={20} color="#007BFF" />
                  <Text style={styles.productName}>{order.product.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calculator-outline" size={20} color="#666" />
                  <Text style={styles.text}>Quantity: {order.quantity}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color="#666" />
                  <Text style={styles.text}>{order.deliveryAddress || `${order.deliveryLatitude}, ${order.deliveryLongitude}`}</Text>
                </View>
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
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.noOrders}>No orders assigned to you currently.</Text>
          </View>
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
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                  pinColor="#007BFF"
                />
              )}
              <Marker
                coordinate={selectedOrderLocation}
                title="Delivery Location"
                pinColor="#28a745"
              />
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#007BFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderIdContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343a40',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007BFF',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noOrders: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverDashboard;