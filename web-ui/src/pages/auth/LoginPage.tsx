import React, { useState } from 'react';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Container,
  Group,
  Checkbox,
  Alert,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconServer, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../stores/AuthContext';
import { LoginCredentials } from '../../services/AuthService';

export const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const form = useForm<LoginCredentials>({
    initialValues: {
      username: 'admin',
      password: 'admin123',
      proxmoxServer: '',
      rememberMe: false,
    },
    validate: {
      username: (value) => (value.length < 1 ? 'Username is required' : null),
      password: (value) => (value.length < 1 ? 'Password is required' : null),
      proxmoxServer: (value) => {
        if (value && value.length > 0) {
          try {
            new URL(value);
            return null;
          } catch {
            return 'Please enter a valid URL';
          }
        }
        return null;
      },
    },
  });

  const handleSubmit = async (values: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container
      size={420}
      my={40}
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <Group mb="xl">
        <IconServer size={40} color="#228be6" />
        <div>
          <Title order={1} size="h2">
            Proxmox-MPC
          </Title>
          <Text c="dimmed" size="sm">
            Interactive Infrastructure Console
          </Text>
        </div>
      </Group>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" style={{ width: '100%' }}>
        <Title order={2} ta="center" mb="md">
          Welcome back
        </Title>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Login Error"
            color="red"
            mb="md"
          >
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="Enter your username"
              required
              {...form.getInputProps('username')}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              required
              {...form.getInputProps('password')}
            />

            <TextInput
              label="Proxmox Server (Optional)"
              placeholder="https://proxmox.local:8006"
              description="Override default server URL"
              {...form.getInputProps('proxmoxServer')}
            />

            <Checkbox
              label="Remember me"
              {...form.getInputProps('rememberMe', { type: 'checkbox' })}
            />

            <Button
              type="submit"
              fullWidth
              mt="xl"
              loading={isLoading}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </Stack>
        </form>

        <Text c="dimmed" size="sm" ta="center" mt="md">
          Default credentials: admin / admin123
        </Text>
      </Paper>
    </Container>
  );
};