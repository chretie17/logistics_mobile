// DriverDashboard.tsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, SafeAreaView, StyleSheet, StatusBar, Dimensions, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import apiService from '../services/api';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import * as TaskManager from 'expo-task-manager';
import { decode } from '@mapbox/polyline';
import { LocationObject } from 'expo-location';
import { useNavigation } from '@react-navigation/native';


const LOCATION_TRACKING = 'location-tracking';
const GOOGLE_MAPS_API_KEY = 'AIzaSyDY0shT-rNkR7RkjMuZpHg58HiL3O6eWyo'; // Replace with your API key
const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
}

interface Order {
  id: string;
  product: Product;
  quantity: number;
  status: string;
  deliveryAddress?: string;
  deliveryLatitude?: string;
  deliveryLongitude?: string;
  orderDeliveredAt?: string;
}

interface LocationType {
  latitude: number;
  longitude: number;
}

interface RouteType {
  coordinates: LocationType[];
  distance: string;
  duration: string;
}

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }: any) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      console.log('New location:', location.coords);
    }
  }
});

const DriverDashboard: React.FC = () => {
  const navigation = useNavigation(); // This is outside the component
  const { user, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null);
  const [selectedOrderLocation, setSelectedOrderLocation] = useState<LocationType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [route, setRoute] = useState<RouteType | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const fetchDriverOrders = async () => {
      if (!user?.id) return;
      
      try {
        const ordersData = await apiService.getOrdersByDriver(user.id);
        if (ordersData?.data) {
          setOrders(ordersData.data);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        Alert.alert('Error', 'Failed to fetch orders');
      }
    };

    fetchDriverOrders();
    const intervalId = setInterval(fetchDriverOrders, 30000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    startLocationTracking();
    return () => {
      stopLocationTracking();
    };
  }, []);

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied');
        return;
      }

      await Location.requestBackgroundPermissionsAsync();

      await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
      });

      setIsTracking(true);

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error('Error starting location tracking:', err);
    }
  };

  const stopLocationTracking = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING);
      setIsTracking(false);
    } catch (err) {
      console.error('Error stopping location tracking:', err);
    }
  };

  const fetchRoute = async (startLoc: LocationType, endLoc: LocationType) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc.latitude},${startLoc.longitude}&destination=${endLoc.latitude},${endLoc.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.routes[0]) {
        const points = decode(data.routes[0].overview_polyline.points);
        const coordinates = points.map((point: number[]) => ({
          latitude: point[0],
          longitude: point[1],
        }));

        setRoute({
          coordinates,
          distance: data.routes[0].legs[0].distance.text,
          duration: data.routes[0].legs[0].duration.text,
        });

        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert('Error', 'Failed to fetch route');
    }
  };

  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      await apiService.markOrderAsDelivered(orderId);
      setOrders(orders.map(order =>
        order.id === orderId 
          ? { ...order, status: 'Order Delivered', orderDeliveredAt: new Date().toISOString() }
          : order
      ));
      Alert.alert('Success', 'Order marked as delivered');
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      Alert.alert('Error', 'Failed to mark order as delivered');
    }
  };

  const handleOpenMapDialog = async (order: Order) => {
    const location = {
      latitude: parseFloat(order.deliveryLatitude || '0'),
      longitude: parseFloat(order.deliveryLongitude || '0'),
    };

    if (location.latitude === 0 || location.longitude === 0) {
      Alert.alert('Error', 'Invalid location coordinates');
      return;
    }

    setSelectedOrderLocation(location);
    setModalVisible(true);

    if (currentLocation) {
      await fetchRoute(currentLocation, location);
    }
  };

  const handleCloseMapDialog = () => {
    setModalVisible(false);
    setSelectedOrderLocation(null);
    setRoute(null);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: () => {
            logout(); // Call the logout function from AuthContext
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }], // Navigate back to Login
            });
          },
        },
      ],
      { cancelable: true }
    );
  };
    const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Order Delivered': return '#28a745';
      case 'In Progress': return '#ffc107';
      default: return '#007bff';
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
    orders.map((order) => (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderId}>Order #{order.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusText}>{order.status}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardContent}>
          {/* Product Information */}
          <View style={styles.productInfo}>
            <Ionicons name="cube-outline" size={20} color="#007BFF" />
            <Text style={styles.productName}>{order.product?.name || 'Unknown Product'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calculator-outline" size={20} color="#666" />
            <Text style={styles.text}>Quantity: {order.quantity}</Text>
          </View>
          {/* User Details */}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <Text style={styles.text}>User: {order.user?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <Text style={styles.text}>Email: {order.user?.email || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
  <Ionicons name="call-outline" size={20} color="#666" />
  {order.user?.phone ? (
    <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.user.phone}`)}>
      <Text style={[styles.text, { color: '#007BFF', textDecorationLine: 'underline' }]}>
        {order.user.phone}
      </Text>
    </TouchableOpacity>
  ) : (
    <Text style={styles.text}>Phone: N/A</Text>
  )}
</View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.text}>
              {order.deliveryAddress || `${order.deliveryLatitude}, ${order.deliveryLongitude}`}
            </Text>
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
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: selectedOrderLocation.latitude,
                longitude: selectedOrderLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              showsTraffic={true}
            >
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                >
                  <View style={styles.currentLocationMarker}>
                    <Ionicons name="car" size={24} color="#007BFF" />
                  </View>
                </Marker>
              )}
              <Marker
                coordinate={selectedOrderLocation}
                title="Delivery Location"
              >
                <View style={styles.destinationMarker}>
                  <Ionicons name="location" size={24} color="#28a745" />
                </View>
              </Marker>
              {route && (
                <Polyline
                  coordinates={route.coordinates}
                  strokeWidth={4}
                  strokeColor="#007BFF"
                  geodesic
                />
              )}
            </MapView>
            {route && (
              <View style={styles.routeInfo}>
                <Text style={styles.routeText}>Distance: {route.distance}</Text>
                <Text style={styles.routeText}>ETA: {route.duration}</Text>
              </View>
            )}
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
  cardContent: {
    padding: 16,
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
  currentLocationMarker: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#007BFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationMarker: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#28a745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeInfo: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007BFF',
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