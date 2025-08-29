import { useState } from 'react';
import {
  Container,
  Tabs,
  Text,
  Alert,
} from '@mantine/core';
import { IconTemplate, IconEdit, IconAlertCircle } from '@tabler/icons-react';

import { TemplateLibrary } from '../components/templates/TemplateLibrary';
import { TemplateDesigner } from '../components/templates/TemplateDesigner';

/**
 * Templates page for Infrastructure as Code template management
 * Provides both template library browsing and template design capabilities
 */
export function TemplatesPage() {
  const [activeTab, setActiveTab] = useState('library');

  const handleDeployTemplate = (template: any, parameters: Record<string, any>) => {
    console.log('Deploying template:', template, 'with parameters:', parameters);
    
    // In real implementation, this would trigger the template deployment process
    // This could involve:
    // 1. Generating Terraform/Ansible files from the template
    // 2. Substituting parameter values
    // 3. Executing the infrastructure deployment
    // 4. Monitoring the deployment progress
  };

  const handleEditTemplate = (template: any) => {
    console.log('Editing template:', template);
    
    // Switch to designer tab with the template data
    setActiveTab('designer');
  };

  const handleSaveTemplate = (template: any) => {
    console.log('Saving template:', template);
    
    // In real implementation, this would save the template to the backend
    // and update the template library
  };

  return (
    <Container fluid>
      <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab 
            value="library" 
            leftSection={<IconTemplate size={16} />}
          >
            Template Library
          </Tabs.Tab>
          <Tabs.Tab 
            value="designer" 
            leftSection={<IconEdit size={16} />}
          >
            Template Designer
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library" pt="xl">
          <TemplateLibrary
            onDeployTemplate={handleDeployTemplate}
            onEditTemplate={handleEditTemplate}
            showDeployment={true}
            showCreation={true}
          />
        </Tabs.Panel>

        <Tabs.Panel value="designer" pt="xl">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Template Designer"
            color="blue"
            mb="lg"
          >
            <Text size="sm">
              Design infrastructure templates with a visual interface. Create reusable templates 
              that can be deployed with customizable parameters.
            </Text>
          </Alert>
          
          <TemplateDesigner
            onSaveTemplate={handleSaveTemplate}
            editMode={false}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}