                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Order #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentID || shipmentData.id}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Assigned Carrier:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1c277d;">${carrierDetails.name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold;">Pending</td></tr>

                    </table>
                </div>

                <!-- Shipment Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.shipmentType || 'freight'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${getBillTypeLabel(shipmentData.shipmentInfo?.billType || 'third_party')}</td></tr> 