/**
 * Accessible Data Table Component
 * 
 * WCAG 2.1 AA compliant table with keyboard navigation, sorting, and screen reader support.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Table, UnstyledButton, Group, Text, Center, TextInput, Checkbox, ActionIcon } from '@mantine/core';
import { IconSelector, IconChevronDown, IconChevronUp, IconSearch, IconX } from '@tabler/icons-react';
import { useKeyboardNavigation, useAnnouncer } from '../../hooks/useAccessibility';

interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  ariaLabel?: string;
}

interface AccessibleTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectable?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onRowClick?: (item: T) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  caption?: string;
  summary?: string;
  getRowId?: (item: T) => string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export function AccessibleTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  onRowClick,
  onSort,
  searchable = false,
  searchPlaceholder = 'Search table...',
  emptyMessage = 'No data available',
  caption,
  summary,
  getRowId = (item) => item.id,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: AccessibleTableProps<T>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  
  const announce = useAnnouncer();
  const tableRef = useRef<HTMLTableElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation for table rows
  const rowIds = filteredData.map((item, index) => `row-${index}`);
  const { activeIndex, containerRef: navContainerRef } = useKeyboardNavigation(
    rowIds,
    (index) => {
      const item = filteredData[index];
      if (onRowClick && item) {
        onRowClick(item);
      }
    }
  );

  // Filter data based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }

    const searchableColumns = columns.filter(col => col.searchable !== false);
    const filtered = data.filter(item =>
      searchableColumns.some(col => {
        const value = item[col.key];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      })
    );

    setFilteredData(filtered);
    announce(`${filtered.length} results found for "${searchQuery}"`, 'polite');
  }, [data, searchQuery, columns, announce]);

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    const newDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(newDirection);
    
    const columnLabel = columns.find(col => col.key === column)?.label || column;
    announce(`Table sorted by ${columnLabel}, ${newDirection}ending order`, 'polite');
    
    if (onSort) {
      onSort(column, newDirection);
    }
  }, [sortBy, sortDirection, columns, announce, onSort]);

  // Handle selection
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!onSelectionChange) return;
    
    const allIds = filteredData.map(getRowId);
    const newSelection = checked ? allIds : [];
    onSelectionChange(newSelection);
    
    announce(`${checked ? 'Selected' : 'Deselected'} all ${filteredData.length} items`, 'polite');
  }, [filteredData, onSelectionChange, getRowId, announce]);

  const handleSelectRow = useCallback((item: T, checked: boolean) => {
    if (!onSelectionChange) return;
    
    const id = getRowId(item);
    const newSelection = checked
      ? [...selectedItems, id]
      : selectedItems.filter(selectedId => selectedId !== id);
    
    onSelectionChange(newSelection);
    
    const itemLabel = item.name || item.title || id;
    announce(`${checked ? 'Selected' : 'Deselected'} ${itemLabel}`, 'polite');
  }, [selectedItems, onSelectionChange, getRowId, announce]);

  // Sort indicator component
  const SortIndicator = ({ column }: { column: Column<T> }) => {
    if (!column.sortable) return <IconSelector size="0.8rem" color="transparent" />;
    
    if (sortBy === column.key) {
      return sortDirection === 'asc' 
        ? <IconChevronUp size="0.8rem" /> 
        : <IconChevronDown size="0.8rem" />;
    }
    
    return <IconSelector size="0.8rem" style={{ opacity: 0.5 }} />;
  };

  // Render table header
  const renderHeader = () => (
    <thead>
      <tr role="row">
        {selectable && (
          <th scope="col" style={{ width: '40px' }}>
            <Checkbox
              checked={selectedItems.length === filteredData.length && filteredData.length > 0}
              indeterminate={selectedItems.length > 0 && selectedItems.length < filteredData.length}
              onChange={(event) => handleSelectAll(event.currentTarget.checked)}
              aria-label={`Select all ${filteredData.length} rows`}
            />
          </th>
        )}
        
        {columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            style={{ 
              width: column.width,
              textAlign: column.align || 'left'
            }}
          >
            {column.sortable ? (
              <UnstyledButton
                onClick={() => handleSort(column.key)}
                style={{ width: '100%' }}
                aria-label={`Sort by ${column.label}${sortBy === column.key ? `, currently ${sortDirection}ending` : ''}`}
                aria-sort={
                  sortBy === column.key 
                    ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                    : 'none'
                }
              >
                <Group justify="space-between" noWrap>
                  <Text fw={500} size="sm">
                    {column.label}
                  </Text>
                  <SortIndicator column={column} />
                </Group>
              </UnstyledButton>
            ) : (
              <Text fw={500} size="sm">
                {column.label}
              </Text>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  // Render table body
  const renderBody = () => (
    <tbody ref={navContainerRef}>
      {filteredData.length === 0 ? (
        <tr>
          <td 
            colSpan={columns.length + (selectable ? 1 : 0)}
            style={{ textAlign: 'center', padding: '2rem' }}
          >
            <Text color="dimmed" size="sm">
              {loading ? 'Loading...' : emptyMessage}
            </Text>
          </td>
        </tr>
      ) : (
        filteredData.map((item, index) => {
          const id = getRowId(item);
          const isSelected = selectedItems.includes(id);
          const isActive = activeIndex === index;
          
          return (
            <tr
              key={id}
              id={`row-${index}`}
              role="row"
              aria-selected={selectable ? isSelected : undefined}
              style={{
                backgroundColor: isActive ? 'var(--mantine-color-blue-0)' : undefined,
                cursor: onRowClick ? 'pointer' : undefined
              }}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onRowClick) onRowClick(item);
                }
              }}
              tabIndex={isActive ? 0 : -1}
            >
              {selectable && (
                <td>
                  <Checkbox
                    checked={isSelected}
                    onChange={(event) => handleSelectRow(item, event.currentTarget.checked)}
                    aria-label={`Select ${item.name || item.title || id}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              )}
              
              {columns.map((column) => (
                <td 
                  key={column.key}
                  style={{ textAlign: column.align || 'left' }}
                >
                  {column.render ? column.render(item) : (
                    <Text size="sm">
                      {item[column.key]?.toString() || '—'}
                    </Text>
                  )}
                </td>
              ))}
            </tr>
          );
        })
      )}
    </tbody>
  );

  return (
    <div>
      {searchable && (
        <Group justify="right" mb="md">
          <TextInput
            ref={searchRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            leftSection={<IconSearch size="0.9rem" />}
            rightSection={
              searchQuery && (
                <ActionIcon
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <IconX size="0.8rem" />
                </ActionIcon>
              )
            }
            aria-label={searchPlaceholder}
            style={{ minWidth: '300px' }}
          />
        </Group>
      )}

      <Table
        ref={tableRef}
        className={className}
        role="table"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-rowcount={filteredData.length}
        aria-colcount={columns.length + (selectable ? 1 : 0)}
      >
        {caption && (
          <caption style={{ captionSide: 'top', marginBottom: '1rem' }}>
            <Text fw={500} size="lg">
              {caption}
            </Text>
            {summary && (
              <Text size="sm" color="dimmed" mt="xs">
                {summary}
              </Text>
            )}
          </caption>
        )}
        
        {renderHeader()}
        {renderBody()}
      </Table>

      {filteredData.length > 0 && (
        <div role="status" aria-live="polite" className="sr-only">
          Showing {filteredData.length} of {data.length} items
          {sortBy && `, sorted by ${columns.find(col => col.key === sortBy)?.label} ${sortDirection}ending`}
          {selectedItems.length > 0 && `, ${selectedItems.length} items selected`}
        </div>
      )}
    </div>
  );
}