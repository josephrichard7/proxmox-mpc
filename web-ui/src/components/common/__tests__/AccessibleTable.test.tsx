import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { AccessibleTable } from '../AccessibleTable';

interface TestItem {
  id: string;
  name: string;
  status: string;
  value: number;
}

describe('AccessibleTable', () => {
  const mockData: TestItem[] = [
    { id: '1', name: 'Item 1', status: 'active', value: 100 },
    { id: '2', name: 'Item 2', status: 'inactive', value: 200 },
    { id: '3', name: 'Item 3', status: 'active', value: 150 },
  ];

  const mockColumns = [
    { key: 'name', label: 'Name', sortable: true, searchable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'value', label: 'Value', sortable: true, align: 'right' as const },
  ];

  const mockOnSort = jest.fn();
  const mockOnRowClick = jest.fn();
  const mockOnSelectionChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with proper table structure and ARIA attributes', () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        aria-label="Test data table"
        caption="List of test items"
        summary="Table showing item details including name, status, and value"
      />
    );

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute('aria-label', 'Test data table');
    expect(table).toHaveAttribute('aria-rowcount', '3');
    expect(table).toHaveAttribute('aria-colcount', '3');

    // Check caption
    expect(screen.getByText('List of test items')).toBeInTheDocument();
    expect(screen.getByText(/table showing item details/i)).toBeInTheDocument();
  });

  it('renders sortable headers with proper ARIA attributes', () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        onSort={mockOnSort}
      />
    );

    const nameHeader = screen.getByRole('button', { name: /sort by name/i });
    const statusHeader = screen.getByRole('button', { name: /sort by status/i });

    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(statusHeader).toHaveAttribute('aria-sort', 'none');

    // Click to sort
    fireEvent.click(nameHeader);
    expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('handles keyboard navigation through rows', () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        onRowClick={mockOnRowClick}
      />
    );

    const firstRow = screen.getByRole('row', { name: /item 1/i });
    
    firstRow.focus();
    expect(firstRow).toHaveFocus();
    expect(firstRow).toHaveAttribute('tabindex', '0');

    // Arrow down navigation
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    const secondRow = screen.getByRole('row', { name: /item 2/i });
    expect(secondRow).toHaveFocus();

    // Enter key should trigger row click
    fireEvent.keyDown(secondRow, { key: 'Enter' });
    expect(mockOnRowClick).toHaveBeenCalledWith(mockData[1]);

    // Space key should also trigger row click
    fireEvent.keyDown(secondRow, { key: ' ' });
    expect(mockOnRowClick).toHaveBeenCalledWith(mockData[1]);
  });

  it('implements search functionality with announcements', async () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        searchable={true}
        searchPlaceholder="Search items..."
      />
    );

    const searchInput = screen.getByLabelText('Search items...');
    expect(searchInput).toBeInTheDocument();

    // Search for "Item 1"
    fireEvent.change(searchInput, { target: { value: 'Item 1' } });

    await waitFor(() => {
      expect(screen.getByText(/1 results found for "item 1"/i)).toBeInTheDocument();
    });

    // Only Item 1 should be visible
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 3')).not.toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('handles row selection with proper announcements', async () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        selectable={true}
        selectedItems={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const selectAllCheckbox = screen.getByLabelText(/select all 3 rows/i);
    const firstRowCheckbox = screen.getByLabelText(/select item 1/i);

    // Select individual row
    fireEvent.click(firstRowCheckbox);
    expect(mockOnSelectionChange).toHaveBeenCalledWith(['1']);

    // Select all rows
    fireEvent.click(selectAllCheckbox);
    expect(mockOnSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);

    await waitFor(() => {
      expect(screen.getByText(/selected all 3 items/i)).toBeInTheDocument();
    });
  });

  it('shows empty state with proper message', () => {
    render(
      <AccessibleTable
        data={[]}
        columns={mockColumns}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <AccessibleTable
        data={[]}
        columns={mockColumns}
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('announces sort changes', async () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        onSort={mockOnSort}
      />
    );

    const nameHeader = screen.getByRole('button', { name: /sort by name/i });
    
    fireEvent.click(nameHeader);
    
    await waitFor(() => {
      expect(screen.getByText(/table sorted by name, ascending order/i)).toBeInTheDocument();
    });

    // Click again for descending
    fireEvent.click(nameHeader);
    
    await waitFor(() => {
      expect(screen.getByText(/table sorted by name, descending order/i)).toBeInTheDocument();
    });
  });

  it('provides status updates via live region', () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
        selectedItems={['1', '2']}
      />
    );

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion).toHaveTextContent(/showing 3 of 3 items.*2 items selected/i);
  });

  it('handles custom column renderers', () => {
    const customColumns = [
      {
        key: 'status',
        label: 'Status',
        render: (item: TestItem) => (
          <span className={`status-${item.status}`}>
            {item.status.toUpperCase()}
          </span>
        ),
      },
    ];

    render(
      <AccessibleTable
        data={mockData}
        columns={customColumns}
      />
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE')).toHaveLength(2);
  });

  it('supports column alignment', () => {
    render(
      <AccessibleTable
        data={mockData}
        columns={mockColumns}
      />
    );

    const valueHeader = screen.getByText('Value').closest('th');
    const valueCell = screen.getByText('100').closest('td');

    expect(valueHeader).toHaveStyle({ textAlign: 'right' });
    expect(valueCell).toHaveStyle({ textAlign: 'right' });
  });
});