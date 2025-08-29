import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** Primary color scheme for Proxmox-MPC */
  primaryColor: 'blue',
  
  /** Color scheme for dark/light mode */
  defaultColorScheme: 'light',
  
  /** Font settings */
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", Consolas, monospace',
  
  /** Custom colors */
  colors: {
    // Custom brand colors for Proxmox-MPC
    proxmox: [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#339af0',
      '#228be6', // Primary brand color
      '#1971c2',
      '#1864ab',
      '#0c5692',
      '#0b4b7a',
    ],
  },
  
  /** Component customizations */
  components: {
    // Custom button styles
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
    
    // Custom input styles
    TextInput: {
      defaultProps: {
        radius: 'sm',
      },
    },
    
    // Custom card styles
    Card: {
      defaultProps: {
        radius: 'md',
        shadow: 'sm',
        withBorder: true,
      },
    },
    
    // Custom paper styles
    Paper: {
      defaultProps: {
        radius: 'md',
        shadow: 'xs',
      },
    },
    
    // Custom table styles
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        withTableBorder: true,
        withColumnBorders: false,
      },
    },
  },
  
  /** Spacing settings */
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  
  /** Border radius settings */
  radius: {
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '1rem',
  },
  
  /** Shadow settings */
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
});