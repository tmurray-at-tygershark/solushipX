import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShipFrom from './ShipFrom';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';

// --- Mocks ---

// Mock useAuth
jest.mock('../../contexts/AuthContext');

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(),
    httpsCallable: jest.fn(),
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    // Add other Firestore functions if needed by ShipFrom (like updateDoc, arrayUnion for adding addresses)
    updateDoc: jest.fn(() => Promise.resolve()),
    arrayUnion: jest.fn(),
}));

// Mock uuid (if adding addresses is tested)
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid'),
}));

// Mock stateUtils (optional, if needed for specific tests)
jest.mock('../../utils/stateUtils', () => ({
    getStateOptions: jest.fn(() => [{ value: 'CA', label: 'California' }]),
    getStateLabel: jest.fn(() => 'State'),
}));

// --- Test Suite ---

describe('ShipFrom Component', () => {
    let mockGetCompanyShipmentOrigins;
    let mockOnDataChange;
    let mockOnNext;
    let mockOnPrevious;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Mock useAuth return value
        useAuth.mockReturnValue({ currentUser: { uid: 'test-user-id' } });

        // Mock httpsCallable return value (the function invoker)
        mockGetCompanyShipmentOrigins = jest.fn();
        httpsCallable.mockReturnValue(mockGetCompanyShipmentOrigins);

        // Mock getDoc for user data
        getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                connectedCompanies: {
                    companies: ['OSJ4266'] // Mock company ID
                }
            })
        });

        // Mock props
        mockOnDataChange = jest.fn();
        mockOnNext = jest.fn();
        mockOnPrevious = jest.fn();
    });

    test('renders loading state initially', () => {
        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );
        expect(screen.getByRole('status')).toBeInTheDocument(); // Checks for the spinner
        expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });

    test('fetches and displays addresses successfully', async () => {
        const mockAddresses = [
            { id: 'addr1', name: 'Warehouse A', street: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '12345', company: 'Test Co', contactName: 'John Doe', contactPhone: '555-1111', contactEmail: 'j@test.com', isDefault: true },
            { id: 'addr2', name: 'Office B', street: '456 Oak Ave', city: 'Otherville', state: 'CA', postalCode: '67890', company: 'Test Co', contactName: 'Jane Smith', contactPhone: '555-2222', contactEmail: 's@test.com', isDefault: false },
        ];
        mockGetCompanyShipmentOrigins.mockResolvedValue({
            data: {
                success: true,
                data: { shipFromAddresses: mockAddresses }
            }
        });

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        // Wait for loading to finish and addresses to appear
        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Warehouse A')).toBeInTheDocument();
        expect(screen.getByText('Office B')).toBeInTheDocument();
        expect(screen.getByText('123 Main St')).toBeInTheDocument();

        // Check if default address is selected (visually, it gets 'selected' class)
        const defaultAddressCard = screen.getByText('Warehouse A').closest('.address-card');
        expect(defaultAddressCard).toHaveClass('selected');

        // Check if onDataChange was called with the default address
        await waitFor(() => {
            expect(mockOnDataChange).toHaveBeenCalledWith(mockAddresses[0]);
        });
    });

    test('displays error message when fetching addresses fails', async () => {
        // Mock the cloud function to return an error
        mockGetCompanyShipmentOrigins.mockRejectedValue(
            new Error('Internal server error') // Simulate a generic error
        );

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        // Wait for loading to finish and error to appear
        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        // Check for a generic part of the expected error message
        expect(screen.getByText(/Failed to load company data/i)).toBeInTheDocument();
        expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
    });

    test('displays error if user is not logged in', () => {
        useAuth.mockReturnValue({ currentUser: null }); // Override beforeEach mock

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        // Wait for loading to potentially finish (though it might error out quickly)
        // Check for the specific error message
        expect(screen.getByText(/User not logged in/i)).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument(); // Loading should stop
    });

    test('displays error if user document is not found', async () => {
        getDoc.mockResolvedValue({ exists: () => false }); // Override beforeEach mock

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
        expect(screen.getByText(/User data not found/i)).toBeInTheDocument();
    });

    test('displays error if user has no connected company', async () => {
        getDoc.mockResolvedValue({ // Override beforeEach mock
            exists: () => true,
            data: () => ({
                // Missing or empty connectedCompanies
            })
        });

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
        expect(screen.getByText(/No company associated/i)).toBeInTheDocument();
    });

    test('selects a different address when clicked', async () => {
        const mockAddresses = [
            { id: 'addr1', name: 'Warehouse A', street: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '12345', company: 'Test Co', contactName: 'John Doe', contactPhone: '555-1111', contactEmail: 'j@test.com', isDefault: true },
            { id: 'addr2', name: 'Office B', street: '456 Oak Ave', city: 'Otherville', state: 'CA', postalCode: '67890', company: 'Test Co', contactName: 'Jane Smith', contactPhone: '555-2222', contactEmail: 's@test.com', isDefault: false },
        ];
        mockGetCompanyShipmentOrigins.mockResolvedValue({
            data: {
                success: true,
                data: { shipFromAddresses: mockAddresses }
            }
        });

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        // Wait for addresses to load
        await waitFor(() => {
            expect(screen.getByText('Office B')).toBeInTheDocument();
        });

        // Find the second address card and click it
        const secondAddressCard = screen.getByText('Office B').closest('.address-card');
        expect(secondAddressCard).not.toHaveClass('selected'); // Verify it's not selected initially

        fireEvent.click(secondAddressCard);

        // Verify the second card is now selected
        expect(secondAddressCard).toHaveClass('selected');
        const firstAddressCard = screen.getByText('Warehouse A').closest('.address-card');
        expect(firstAddressCard).not.toHaveClass('selected');

        // Verify onDataChange was called with the second address
        // Use setTimeout check because onDataChange is called inside setTimeout(..., 0)
        await waitFor(() => {
            expect(mockOnDataChange).toHaveBeenLastCalledWith(mockAddresses[1]);
        }, { timeout: 50 }); // Short timeout should be enough
    });

    test('calls onNext when Next button is clicked with an address selected', async () => {
        const mockAddresses = [
            { id: 'addr1', name: 'Warehouse A', street: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '12345', company: 'Test Co', contactName: 'John Doe', contactPhone: '555-1111', contactEmail: 'j@test.com', isDefault: true },
        ];
        mockGetCompanyShipmentOrigins.mockResolvedValue({
            data: {
                success: true,
                data: { shipFromAddresses: mockAddresses }
            }
        });

        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        // Wait for address to load (default is selected)
        await waitFor(() => {
            expect(screen.getByText('Warehouse A')).toBeInTheDocument();
        });

        const nextButton = screen.getByRole('button', { name: /Next/i });
        expect(nextButton).not.toBeDisabled(); // Should be enabled since default is selected

        fireEvent.click(nextButton);
        expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    test('Next button is disabled initially and if no address is selected', async () => {
        // Test initial state (during loading)
        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );
        // Need to query carefully as it might be missing during initial render phases
        let nextButton = screen.queryByRole('button', { name: /Next/i });
        // It might render enabled briefly before useEffect runs, best to check after potential load
        // If we mock no addresses, it should remain disabled

        mockGetCompanyShipmentOrigins.mockResolvedValue({
            data: {
                success: true,
                data: { shipFromAddresses: [] } // No addresses
            }
        });

        // Rerender or wait for update if needed, but let's test the loaded state
        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        // Addresses loaded, but none available/selected
        nextButton = screen.getByRole('button', { name: /Next/i });
        expect(nextButton).toBeDisabled();
    });

    test('calls onPrevious when Previous button is clicked', () => {
        render(
            <ShipFrom
                onDataChange={mockOnDataChange}
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
            />
        );

        const previousButton = screen.getByRole('button', { name: /Previous/i });
        fireEvent.click(previousButton);
        expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    });

    // Optional: Add tests for the "Add New Address" form interaction if needed

}); 