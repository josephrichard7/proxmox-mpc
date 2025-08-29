import React from 'react';
import { Title, Text, Card } from '@mantine/core';
import { useParams } from 'react-router-dom';

export const VMDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <Title order={2} mb="md">Virtual Machine Details</Title>
      <Text c="dimmed" mb="xl">
        VM ID: {id}
      </Text>
      
      <Card withBorder>
        <Text c="dimmed" ta="center" py="xl">
          VM details interface will be implemented here
        </Text>
      </Card>
    </div>
  );
};