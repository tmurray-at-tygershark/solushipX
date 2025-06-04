import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export const EVENT_TYPES = {
  CREATED: "created",
  STATUS_UPDATE: "status_update",
  TRACKING_UPDATE: "tracking_update",
  CONFIRMATION: "confirmation",
  ERROR: "error",
  USER_ACTION: "user_action",
  CARRIER_UPDATE: "carrier_update",
  DOCUMENT_GENERATED: "document_generated",
  RATE_SELECTED: "rate_selected",
  BOOKING_CONFIRMED: "booking_confirmed"
};

export const EVENT_SOURCES = {
  SYSTEM: "system",
  CARRIER: "carrier", 
  USER: "user",
  API: "api"
};

export const recordShipmentEvent = async (shipmentId, eventData, userData = null) => {
  try {
    if (!shipmentId || !eventData) {
      throw new Error("Shipment ID and event data are required");
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const event = {
      eventId,
      timestamp,
      eventType: eventData.eventType || EVENT_TYPES.USER_ACTION,
      title: eventData.title || "Shipment Event",
      description: eventData.description || "",
      source: eventData.source || EVENT_SOURCES.SYSTEM,
      sourceCarrier: eventData.sourceCarrier || null,
      userData: userData ? {
        userEmail: userData.email || null,
        userId: userData.uid || null,
        userName: userData.displayName || userData.email || "Unknown User"
      } : null,
      statusChange: eventData.statusChange || null,
      trackingData: eventData.trackingData || null,
      metadata: eventData.metadata || {}
    };

    const shipmentEventsRef = doc(db, "shipmentEvents", shipmentId);
    const shipmentEventsDoc = await getDoc(shipmentEventsRef);

    if (shipmentEventsDoc.exists()) {
      await updateDoc(shipmentEventsRef, {
        events: arrayUnion(event),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(shipmentEventsRef, {
        shipmentID: shipmentId,
        events: [event],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    console.log(`📝 Recorded event: ${eventData.title} for shipment ${shipmentId}`);
    return true;

  } catch (error) {
    console.error("Error recording shipment event:", error);
    return false;
  }
};

export const getShipmentEvents = async (shipmentId) => {
  try {
    const shipmentEventsRef = doc(db, "shipmentEvents", shipmentId);
    const shipmentEventsDoc = await getDoc(shipmentEventsRef);

    if (!shipmentEventsDoc.exists()) {
      return [];
    }

    const data = shipmentEventsDoc.data();
    const events = data.events || [];

    // Sort events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return events;

  } catch (error) {
    console.error("Error getting shipment events:", error);
    return [];
  }
};

export const recordStatusChange = async (shipmentId, fromStatus, toStatus, userData = null, reason = "") => {
  const eventData = {
    eventType: EVENT_TYPES.STATUS_UPDATE,
    title: `Status Updated: ${toStatus}`,
    description: `Shipment status changed from \"${fromStatus}\" to \"${toStatus}\"${reason ? `. Reason: ${reason}` : ""}`,
    source: userData ? EVENT_SOURCES.USER : EVENT_SOURCES.SYSTEM,
    statusChange: {
      from: fromStatus,
      to: toStatus,
      reason: reason
    }
  };
  
  return await recordShipmentEvent(shipmentId, eventData, userData);
};

export const recordTrackingUpdate = async (shipmentId, trackingUpdates, carrier) => {
  if (!trackingUpdates || trackingUpdates.length === 0) {
    return false;
  }

  // Get existing events to check for duplicates
  const existingEvents = await getShipmentEvents(shipmentId);
  
  const latestUpdate = trackingUpdates[trackingUpdates.length - 1];
  
  // Make duplicate detection much more robust
  const statusToCheck = latestUpdate.status || latestUpdate.description;
  const timestampToCheck = new Date(latestUpdate.timestamp);
  
  // Check if an identical or very similar tracking event already exists
  const isDuplicate = existingEvents.some(event => {
    if (event.eventType !== EVENT_TYPES.TRACKING_UPDATE) {
      return false;
    }
    
    // Check carrier match
    const carrierMatches = event.sourceCarrier === carrier || 
                          (event.sourceCarrier === 'eShipPlus' && carrier === 'eShipPlus') ||
                          (event.sourceCarrier === 'eShipPlus' && carrier === 'eshipplus') ||
                          (event.sourceCarrier === 'eshipplus' && carrier === 'eShipPlus');
    
    if (!carrierMatches) {
      return false;
    }
    
    // Check status/description match (handle both old format "AA" and new format "Shipment created")
    const eventStatus = event.trackingData?.latestStatus || event.description;
    const statusMatches = eventStatus === statusToCheck ||
                         (eventStatus?.includes('AA') && statusToCheck?.includes('Shipment created')) ||
                         (eventStatus?.includes('Shipment created') && statusToCheck?.includes('AA')) ||
                         (eventStatus === latestUpdate.rawStatusCode) ||
                         (event.trackingData?.rawStatusCode === latestUpdate.rawStatusCode);
    
    if (!statusMatches) {
      return false;
    }
    
    // Check timestamp - events within 1 hour are considered duplicates
    const eventTimestamp = new Date(event.timestamp);
    const timeDifference = Math.abs(eventTimestamp - timestampToCheck);
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    const timeMatches = timeDifference < oneHour;
    
    const matches = carrierMatches && statusMatches && timeMatches;
    
    if (matches) {
      console.log(`📋 Detected duplicate tracking event:`, {
        shipmentId,
        newStatus: statusToCheck,
        newCarrier: carrier,
        newTimestamp: timestampToCheck,
        existingStatus: eventStatus,
        existingCarrier: event.sourceCarrier,
        existingTimestamp: eventTimestamp,
        timeDifference: `${Math.round(timeDifference / 1000 / 60)} minutes`
      });
    }
    
    return matches;
  });

  // If this is a duplicate event, don't record it
  if (isDuplicate) {
    console.log(`📋 Skipping duplicate tracking event: ${statusToCheck} for shipment ${shipmentId}`);
    return false;
  }
  
  const eventData = {
    eventType: EVENT_TYPES.TRACKING_UPDATE,
    title: "Tracking Update",
    description: `${carrier}: ${statusToCheck}${latestUpdate.location ? ` in ${latestUpdate.location}` : ""}`,
    source: EVENT_SOURCES.CARRIER,
    sourceCarrier: carrier,
    trackingData: {
      latestStatus: statusToCheck,
      location: latestUpdate.location,
      timestamp: latestUpdate.timestamp,
      rawStatusCode: latestUpdate.rawStatusCode, // Include raw status code for duplicate detection
      allUpdates: trackingUpdates
    }
  };
  
  console.log(`📝 Recording new tracking event:`, {
    shipmentId,
    status: statusToCheck,
    carrier,
    rawStatusCode: latestUpdate.rawStatusCode
  });
  
  return await recordShipmentEvent(shipmentId, eventData);
};

// New function to listen for real-time shipment event updates
export const listenToShipmentEvents = (shipmentId, callback) => {
  if (!shipmentId) {
    console.error("Shipment ID is required to listen to events.");
    return () => {}; // Return a no-op unsubscribe function
  }

  const shipmentEventsRef = doc(db, "shipmentEvents", shipmentId);

  const unsubscribe = onSnapshot(shipmentEventsRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      const events = data.events || [];
      // Sort events by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(events);
    } else {
      // Document doesn't exist (e.g., new shipment with no events yet)
      callback([]);
    }
  }, (error) => {
    console.error("Error listening to shipment events:", error);
    // Optionally, you could call the callback with an error indicator or an empty array
    callback([]); 
  });

  return unsubscribe; // Return the unsubscribe function to stop listening
};

// New function to clean up duplicate tracking events
export const cleanupDuplicateTrackingEvents = async (shipmentId) => {
  try {
    const shipmentEventsRef = doc(db, "shipmentEvents", shipmentId);
    const shipmentEventsDoc = await getDoc(shipmentEventsRef);

    if (!shipmentEventsDoc.exists()) {
      return { success: false, message: "No events found for this shipment" };
    }

    const data = shipmentEventsDoc.data();
    const events = data.events || [];

    // Filter out tracking update duplicates
    const trackingEvents = events.filter(event => event.eventType === EVENT_TYPES.TRACKING_UPDATE);
    const otherEvents = events.filter(event => event.eventType !== EVENT_TYPES.TRACKING_UPDATE);
    
    // Group tracking events by carrier + status code + rough timestamp (within 1 hour)
    const uniqueTrackingEvents = [];
    const seenEvents = new Set();
    
    // Sort by timestamp (newest first) to keep the most recent of each duplicate
    trackingEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    for (const event of trackingEvents) {
      const carrier = event.sourceCarrier || 'unknown';
      const status = event.trackingData?.latestStatus || event.description || 'unknown';
      const rawStatusCode = event.trackingData?.rawStatusCode || 'unknown';
      const timestamp = new Date(event.timestamp);
      const hourBucket = Math.floor(timestamp.getTime() / (60 * 60 * 1000)); // Group by hour
      
      // Create a unique key for this event
      const eventKey = `${carrier}-${rawStatusCode}-${hourBucket}`;
      
      if (!seenEvents.has(eventKey)) {
        seenEvents.add(eventKey);
        uniqueTrackingEvents.push(event);
      } else {
        console.log(`🗑️ Removing duplicate event: ${status} (${carrier}) at ${timestamp}`);
      }
    }
    
    // Combine unique tracking events with other events
    const cleanedEvents = [...uniqueTrackingEvents, ...otherEvents];
    
    // Sort all events by timestamp (newest first)
    cleanedEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const removedCount = events.length - cleanedEvents.length;
    
    if (removedCount > 0) {
      // Update the document with cleaned events
      await updateDoc(shipmentEventsRef, {
        events: cleanedEvents,
        updatedAt: serverTimestamp()
      });
      
      console.log(`🧹 Cleaned up ${removedCount} duplicate tracking events for shipment ${shipmentId}`);
      return { 
        success: true, 
        message: `Removed ${removedCount} duplicate events`,
        removedCount,
        remainingCount: cleanedEvents.length
      };
    } else {
      return { 
        success: true, 
        message: "No duplicates found",
        removedCount: 0,
        remainingCount: cleanedEvents.length
      };
    }

  } catch (error) {
    console.error("Error cleaning up duplicate events:", error);
    return { success: false, message: `Error: ${error.message}` };
  }
};