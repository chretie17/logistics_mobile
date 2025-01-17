import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.110.7.226:3000/api'; // Use http instead of https

class ApiService {
  private api;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 10000, // Optional: Set a timeout for requests
    });

    // Automatically set the Authorization token if available
    this.initialize();
  }

  private async initialize() {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      this.setAuthToken(token);
    }
  }

  // Set the Authorization token in the request headers
  public setAuthToken(token: string | null) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  // Decode JWT token manually
  public decodeToken(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');

      const jsonPayload = decodeURIComponent(
        atob(paddedBase64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  // Handle user login with email and password
  public async login(email: string, password: string) {
    try {
      const response = await this.api.post('/users/login', { email, password });
      const token = response.data.token;

      // Store the token in AsyncStorage
      await AsyncStorage.setItem('token', token);

      // Decode the token to get user details
      const decodedToken = this.decodeToken(token);
      const userData = {
        token,
        id: decodedToken.id,
        role: decodedToken.role,
      };

      // Set the token in the headers for future requests
      this.setAuthToken(token);

      // Return the decoded user data
      return userData;
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Handle user logout
  public async logout() {
    await AsyncStorage.removeItem('token');
    this.setAuthToken(null);
  }

  // Fetch orders assigned to a driver
  public async getOrdersByDriver(driverId: string) {
    try {
      const response = await this.api.get(`/orders/driver/${driverId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  // Mark an order as delivered
  public async markOrderAsDelivered(orderId: string) {
    try {
      const response = await this.api.put(`/orders/mark-delivered/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      throw error;
    }
  }
}

// Export a single instance of the ApiService class
const apiService = new ApiService();
export default apiService;
