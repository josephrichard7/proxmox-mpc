import React from 'react';
import { Title, Text, Card } from '@mantine/core';

export const SettingsPage: React.FC = () => {
  return (
    <div>
      <Title order={2} mb="md">Settings</Title>
      <Text c="dimmed" mb="xl">
        Configure your application settings
      </Text>
      
      <Card withBorder>
        <Text c="dimmed" ta="center" py="xl">
          Settings interface will be implemented here
        </Text>
      </Card>
    </div>
  );
};