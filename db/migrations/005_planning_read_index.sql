-- Read access for date-based planning. Availability remains protected by 003.
CREATE INDEX booking_interval_read ON booking(starts_at,ends_at);
