import { useState } from 'react';
import { MantineProvider, Container, Title, Text, Button, Stack, TextInput, PasswordInput, Paper, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import axios from 'axios';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        username,
        password
      });
      
      if (response.data.success) {
        setIsLoggedIn(true);
        setUserData(response.data.data.user);
        localStorage.setItem('token', response.data.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserData(null);
    localStorage.removeItem('token');
    setUsername('');
    setPassword('');
  };

  if (!isLoggedIn) {
    return (
      <Container size="xs" mt={100}>
        <Paper shadow="md" p="xl" radius="md">
          <Stack gap="md">
            <div>
              <Title order={2} ta="center">Proxmox-MPC Dashboard</Title>
              <Text c="dimmed" size="sm" ta="center" mt={5}>
                Login to access your infrastructure
              </Text>
            </div>
            
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}
            
            <TextInput
              label="Username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
            />
            
            <PasswordInput
              label="Password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            
            <Button 
              fullWidth 
              loading={loading}
              onClick={handleLogin}
              disabled={!username || !password}
            >
              Sign in
            </Button>
            
            <Text c="dimmed" size="xs" ta="center">
              Default credentials: admin / admin123
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container mt={50}>
      <Stack gap="lg">
        <Paper shadow="sm" p="lg" radius="md">
          <Title order={2}>Welcome to Proxmox-MPC Dashboard!</Title>
          <Text mt="md">You are logged in as: <strong>{userData?.username}</strong></Text>
          <Text c="dimmed">Email: {userData?.email}</Text>
          <Text c="dimmed">Role: {userData?.role}</Text>
        </Paper>
        
        <Paper shadow="sm" p="lg" radius="md">
          <Title order={3}>Infrastructure Overview</Title>
          <Text mt="md">The full dashboard features are being loaded...</Text>
          <Text c="dimmed" size="sm">
            • Virtual Machines Management<br/>
            • Container Management<br/>
            • Node Monitoring<br/>
            • Configuration Editor<br/>
            • Network Visualization
          </Text>
        </Paper>
        
        <Button onClick={handleLogout} variant="light">
          Logout
        </Button>
      </Stack>
    </Container>
  );
}

export default App;