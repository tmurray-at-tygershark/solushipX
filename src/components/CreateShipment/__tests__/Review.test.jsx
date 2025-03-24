import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Review from '../Review';

// Mock SOAP response data
const mockSoapResponse = {
    success: true,
    data: {
        'soap:Envelope': {
            'soap:Body': {
                RateResponse: {
                    RateResult: {
                        AvailableRates: [
                            {
                                QuoteId: '123',
                                CarrierName: 'Test Carrier',
                                ServiceMode: 'Express',
                                TotalCharges: '100.00',
                                TransitTime: '2',
                                EstimatedDeliveryDate: '2024-03-20T00:00:00',
                                GuarOptions: [
                                    {
                                        BillingCode: 'GUAR'
                                    }
                                ],
                                BillingDetails: [
                                    {
                                        Description: 'Fuel Surcharge',
                                        AmountDue: '10.00',
                                        Category: 'Surcharge'
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
    }
};

// Mock fetch function
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSoapResponse)
    })
);

describe('Review Component', () => {
    const mockFormData = {
        shipmentInfo: {
            shipmentType: 'courier',
            shipmentDate: '2024-03-18',
            earliestPickup: '09:00',
            latestPickup: '17:00',
            earliestDelivery: '09:00',
            latestDelivery: '17:00'
        },
        shipFrom: {
            company: 'Test Company',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
            contactName: 'John Doe',
            contactPhone: '123-456-7890',
            contactEmail: 'john@test.com'
        },
        shipTo: {
            company: 'Test Company 2',
            street: '456 Test St',
            city: 'Test City 2',
            state: 'TS',
            postalCode: '54321',
            country: 'US',
            contactName: 'Jane Doe',
            contactPhone: '098-765-4321',
            contactEmail: 'jane@test.com'
        },
        packages: [
            {
                description: 'Test Package',
                weight: '10',
                length: '12',
                width: '12',
                height: '12',
                quantity: '1',
                freightClass: '50',
                value: '100',
                stackable: true
            }
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('parses SOAP response correctly and displays rates', async () => {
        render(<Review formData={mockFormData} onPrevious={() => { }} />);

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('Loading available rates...')).not.toBeInTheDocument();
        });

        // Verify rate card is displayed
        expect(screen.getByText('Test Carrier')).toBeInTheDocument();
        expect(screen.getByText('Express')).toBeInTheDocument();
        expect(screen.getByText('USD 100.00')).toBeInTheDocument();
        expect(screen.getByText('2 days')).toBeInTheDocument();
        expect(screen.getByText('2024-03-20')).toBeInTheDocument();
        expect(screen.getByText('Guaranteed')).toBeInTheDocument();
        expect(screen.getByText('Express')).toBeInTheDocument();
    });

    test('handles error when SOAP response is invalid', async () => {
        // Mock invalid response
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        'soap:Envelope': {
                            'soap:Body': {
                                RateResponse: {
                                    RateResult: null // Invalid response
                                }
                            }
                        }
                    }
                })
            })
        );

        render(<Review formData={mockFormData} onPrevious={() => { }} />);

        // Wait for error message
        await waitFor(() => {
            expect(screen.getByText(/No RateResult found in response/)).toBeInTheDocument();
        });
    });

    test('handles empty rates array', async () => {
        // Mock empty rates response
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        'soap:Envelope': {
                            'soap:Body': {
                                RateResponse: {
                                    RateResult: {
                                        AvailableRates: []
                                    }
                                }
                            }
                        }
                    }
                })
            })
        );

        render(<Review formData={mockFormData} onPrevious={() => { }} />);

        // Wait for error message
        await waitFor(() => {
            expect(screen.getByText(/No rates available/)).toBeInTheDocument();
        });
    });
}); 