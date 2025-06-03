const admin = require('firebase-admin');
const db = admin.firestore();

const EVENT_TYPES = {
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

const EVENT_SOURCES = {
  SYSTEM: "system",
  CARRIER: "carrier", 
  USER: "user",
  API: "api"
};

const recordShipmentEvent = async (shipmentId, eventType, title, description, source = EVENT_SOURCES.SYSTEM, userData = null, metadata = {}) => {
  try {
    if (!shipmentId || !eventType || !title) {
      throw new Error("Shipment ID, event type, and title are required");
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const event = {
      eventId,
      timestamp,
      eventType,
      title,
      description: description || "",
      source: source || EVENT_SOURCES.SYSTEM,
      userData: userData ? {
        email: userData.email || null,
        userId: userData.userId || userData.uid || null,
        userName: userData.userName || userData.displayName || userData.email || "Unknown User"
      } : null,
      metadata: metadata || {}
    };

    const shipmentEventsRef = db.doc(`shipmentEvents/${shipmentId}`);
    const shipmentEventsDoc = await shipmentEventsRef.get();

    if (shipmentEventsDoc.exists) {
      await shipmentEventsRef.update({
        events: admin.firestore.FieldValue.arrayUnion(event),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await shipmentEventsRef.set({
        shipmentID: shipmentId,
        events: [event],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`📝 Recorded event: ${title} for shipment ${shipmentId}`);
    return true;

  } catch (error) {
    console.error("Error recording shipment event:", error);
    return false;
  }
};

const getShipmentEvents = async (shipmentId) => {
  try {
    const shipmentEventsRef = db.doc(`shipmentEvents/${shipmentId}`);
    const shipmentEventsDoc = await shipmentEventsRef.get();

    if (!shipmentEventsDoc.exists) {
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

const recordStatusChange = async (shipmentId, fromStatus, toStatus, userData = null, reason = "") => {
  return await recordShipmentEvent(
    shipmentId, 
    EVENT_TYPES.STATUS_UPDATE,
    `Status Updated: ${toStatus}`,
    `Shipment status changed from "${fromStatus}" to "${toStatus}"${reason ? `. Reason: ${reason}` : ""}`,
    userData ? EVENT_SOURCES.USER : EVENT_SOURCES.SYSTEM,
    userData,
    {
    statusChange: {
      from: fromStatus,
      to: toStatus,
      reason: reason
    }
    }
  );
};

const recordTrackingUpdate = async (shipmentId, trackingUpdates, carrier) => {
  if (!trackingUpdates || trackingUpdates.length === 0) {
    return false;
  }

  const latestUpdate = trackingUpdates[trackingUpdates.length - 1];
  
  let description = latestUpdate.description || latestUpdate.status || 'Status update';
  
  if (latestUpdate.location) {
    description += ` in ${latestUpdate.location}`;
  }
  
  return await recordShipmentEvent(
    shipmentId,
    EVENT_TYPES.TRACKING_UPDATE,
    "Tracking Update",
    `${carrier}: ${description}`,
    EVENT_SOURCES.CARRIER,
    null,
    {
    sourceCarrier: carrier,
    trackingData: {
      latestStatus: latestUpdate.status,
      latestDescription: latestUpdate.description,
      location: latestUpdate.location,
      timestamp: latestUpdate.timestamp,
      allUpdates: trackingUpdates
    }
    }
  );
};

module.exports = {
  EVENT_TYPES,
  EVENT_SOURCES,
  recordShipmentEvent,
  getShipmentEvents,
  recordStatusChange,
  recordTrackingUpdate
};