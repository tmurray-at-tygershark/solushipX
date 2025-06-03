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

  const latestUpdate = trackingUpdates[trackingUpdates.length - 1];
  
  const eventData = {
    eventType: EVENT_TYPES.TRACKING_UPDATE,
    title: "Tracking Update",
    description: `${carrier}: ${latestUpdate.status || latestUpdate.description}${latestUpdate.location ? ` in ${latestUpdate.location}` : ""}`,
    source: EVENT_SOURCES.CARRIER,
    sourceCarrier: carrier,
    trackingData: {
      latestStatus: latestUpdate.status,
      location: latestUpdate.location,
      timestamp: latestUpdate.timestamp,
      allUpdates: trackingUpdates
    }
  };
  
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